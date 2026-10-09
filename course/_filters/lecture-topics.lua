-- Build the home overview from the authored lecture catalogue, not a directory scan.
local function fail(message)
  error("Lecture catalogue: " .. message)
end

function Div(el)
  if not el.classes:includes("home-topics") then
    return nil
  end

  local source = el.attributes["source"] or "lectures/index.qmd"
  local input = quarto and quarto.doc.input_file or PANDOC_STATE.input_files[1]
  local root = pandoc.path.directory(input)
  local file, message = io.open(pandoc.path.join({root, source}), "r")
  if not file then fail(message) end
  local catalogue = pandoc.read(file:read("*a"), "markdown")
  file:close()

  local entries
  for _, block in ipairs(catalogue.blocks) do
    if block.t == "BulletList" or block.t == "OrderedList" then
      if entries then fail("expected one top-level lecture list in " .. source) end
      entries = block.content
    end
  end
  if not entries or #entries == 0 then fail("no lectures in " .. source) end

  local items = pandoc.List()
  for _, entry in ipairs(entries) do
    local first = entry[1]
    if not first or (first.t ~= "Plain" and first.t ~= "Para")
        or not first.content[1] or first.content[1].t ~= "Link" then
      fail("each entry must start with a lecture link in " .. source)
    end
    local link = first.content[1]
    -- Only explicitly published local lectures belong in this overview.
    if not link.target:match("%.qmd$") or link.target:match("^[/\\]")
        or link.target:match("^%a[%w+.-]*:") or link.target:match("%.%.") then
      fail("expected a local .qmd lecture: " .. link.target)
    end
    link.target = pandoc.path.join({pandoc.path.directory(source), link.target}):gsub("\\", "/")
    local target = io.open(pandoc.path.join({root, link.target}), "r")
    if not target then fail("missing lecture: " .. link.target) end
    target:close()

    local description = pandoc.List()
    for i = 2, #first.content do description:insert(first.content[i]) end
    while #description > 0 and (description[1].t == "Space"
        or (description[1].t == "Str" and description[1].text == "—")) do
      description:remove(1)
    end
    local blocks = pandoc.List({pandoc.Para({pandoc.Strong({link})})})
    if #description > 0 then blocks:insert(pandoc.Para(description)) end
    for i = 2, #entry do blocks:insert(entry[i]) end
    items:insert(blocks)
  end

  el.attributes["source"] = nil
  el.content = pandoc.Blocks({pandoc.BulletList(items)})
  return el
end
