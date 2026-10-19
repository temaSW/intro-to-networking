"""Validate student assessment data; optionally check local teacher keys or export QMD."""

from pathlib import Path
import argparse
import json
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
BANK = ROOT / "course/self-study/bank.json"
TEACHER = ROOT / "docs/assessment/answers.json"
PRIVATE_FIELDS = {"expected_answer", "solution", "grading_criteria", "alternatives", "typical_errors"}
TYPES = {"understanding", "application", "calculation", "comparison", "synthesis", "diagnosis", "parameters", "analysis"}
DIFFICULTIES = {"базовая", "средняя", "повышенная"}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def reject_private(value):
    if isinstance(value, dict):
        assert not PRIVATE_FIELDS.intersection(value), "Teacher fields in public data"
        for child in value.values():
            reject_private(child)
    elif isinstance(value, list):
        for child in value:
            reject_private(child)
    elif isinstance(value, str):
        assert not any(ord(c) < 32 and c not in "\n\t" for c in value), "Control character in public content"


def validate(bank, teacher=None):
    reject_private(bank)
    assert set(bank) == {"version", "topics"} and bank["topics"]
    assert bank["version"] == 1
    ids, topics = set(), set()
    question_texts = set()
    for topic in bank["topics"]:
        assert set(topic) == {"id", "title", "learning_outcomes", "limitations", "assignments", "questions", "reminder"}
        tid = topic["id"]
        assert tid not in topics, f"Duplicate topic: {tid}"
        topics.add(tid)
        assert re.fullmatch(r"\d{2}", tid)
        assert topic["title"] and topic["limitations"] and topic["reminder"]
        outcomes = topic["learning_outcomes"]
        assert outcomes and all(outcomes.values())
        assert 4 <= len(topic["assignments"]) <= 6, tid
        assert len(topic["questions"]) == 20, f"Expected 20 questions: {tid}"
        covered = {"assignments": set(), "questions": set()}
        for group in covered:
            for item in topic[group]:
                iid = item["id"]
                fields = {"id", "topic", "type", "difficulty", "learning_outcome", "question", "source", "assessment_focus"}
                if group == "assignments":
                    fields |= {"title", "data", "assumptions", "deliverable", "hint", "extension"}
                assert set(item) == fields, f"Unexpected/missing fields: {iid}"
                assert iid not in ids, f"Duplicate item: {iid}"
                assert re.fullmatch(rf"T{tid}-{'A' if group == 'assignments' else 'E'}\d{{2}}", iid), iid
                ids.add(iid)
                assert item["topic"] == tid, iid
                assert item["question"].strip(), iid
                if group == "questions":
                    normalized = " ".join(item["question"].casefold().split())
                    assert normalized not in question_texts, f"Duplicate question wording: {iid}"
                    question_texts.add(normalized)
                assert len(item["assessment_focus"]) == 2 and all(item["assessment_focus"]), iid
                assert item["difficulty"] in DIFFICULTIES, iid
                assert item["type"] in TYPES, iid
                assert item["learning_outcome"] in outcomes, iid
                covered[group].add(item["learning_outcome"])
                if group == "assignments":
                    for field in ("data", "assumptions", "deliverable", "hint", "extension"):
                        assert item[field].strip(), f"Missing {field}: {iid}"
                source = item["source"]
                assert set(source) == {"path", "section"}, iid
                path = (ROOT / source["path"]).resolve()
                assert path.is_relative_to((ROOT / "course").resolve()), iid
                assert path.suffix == ".qmd" and path.is_file(), iid
                text = path.read_text(encoding="utf-8")
                headings = [re.sub(r"\s*\{[^}]*\}\s*$", "", line.lstrip("# "))
                            for line in text.splitlines() if re.match(r"^#{1,6} ", line)]
                assert source["section"] in headings, f"Missing section: {iid} {source}"
                if teacher is not None:
                    answer = teacher["items"][iid]
                    assert answer["expected_answer"].strip(), iid
                    assert answer["alternatives"].strip(), iid
                    assert answer["typical_errors"].strip(), iid
                    criteria = answer["grading_criteria"]
                    assert len(criteria) >= 2 and all(c["criterion"].strip() and c["points"] > 0 for c in criteria), iid
                    assert sum(c["points"] for c in criteria) == 4, iid
        for group, actual in covered.items():
            assert actual == set(outcomes), f"Uncovered outcomes in {tid}/{group}: {set(outcomes) - actual}"
        assert any(a["difficulty"] == "базовая" for a in topic["assignments"]), tid
    if teacher is not None:
        assert set(teacher["items"]) == ids, "Teacher/public item mismatch"
        public_text = json.dumps(bank, ensure_ascii=False)
        for iid, answer in teacher["items"].items():
            assert answer["expected_answer"] not in public_text, f"Complete teacher answer in public content: {iid}"
    return ids


def source_link(item):
    source = item["source"]
    relative = source["path"].removeprefix("course/")
    text = (ROOT / source["path"]).read_text(encoding="utf-8")
    for line in text.splitlines():
        if not re.match(r"^#{1,6} ", line):
            continue
        heading = re.sub(r"\s*\{[^}]*\}\s*$", "", line.lstrip("# "))
        if heading == source["section"]:
            explicit = re.search(r"\{#([^ }]+)", line)
            anchor = explicit[1] if explicit else re.sub(r"\s+", "-", re.sub(r"[^\w\s.-]", "", heading.lower()))
            return f'[{source["section"]}](../{relative}#{anchor})'
    raise AssertionError(f"Missing source heading: {source}")


def render_topic(topic):
    lines = ["---", f'title: "Самостоятельная работа. Тема {topic["id"]}"',
             f'subtitle: "{topic["title"]}"', "toc-depth: 2", "---", "",
             "## Как работать", "",
             "Начните с базового задания. Для каждого ответа запишите исходные данные, ход рассуждения и вывод. "
             "Формулы и единицы можно сверять с лекцией; калькулятор разрешён. Программирование не требуется. "
             "Если подготовка прервалась, воспользуйтесь подсказкой и вернитесь к тому же заданию.", "",
             "Подсказки доступны всем. Правильное рассуждение с арифметической ошибкой позволяет получить часть баллов. "
             "Понятная схема, таблица или связный текст равно допустимы. Сначала выполняйте задания без дополнительного усложнения; "
             "блоки «Дальше» необязательны и не заменяют базовые умения. Работа не ограничена таймером; разбивайте её на подходящие вам этапы.", "",
             "Это учебный комплект. Срок сдачи, обязательный объём и перевод баллов в отметку задаёт преподаватель. "
             "Пометка сложности относится к заданию и не определяет способности студента. "
             "Проверьте с преподавателем, какие разделы уже разобраны на занятиях.", "",
             "Каждое задание и вопрос оцениваются по двум указанным признакам, каждый от 0 до 2 баллов: "
             "0 -- неверно или отсутствует; 1 -- частично верно; 2 -- верно и обосновано. "
             "Зависимые шаги не штрафуются повторно за одну арифметическую ошибку. "
             "Разумное альтернативное решение принимается при проверке условий. Для расчётов допустимо округление до 1%, если оно не меняет вывод о выполнении ограничения.", "",
             "**Границы комплекта:** " + topic["limitations"], "", "## Опоры перед началом", "", topic["reminder"], "", "## Что проверяем", ""]
    lines += [f'- **{key}**: {value}' for key, value in topic["learning_outcomes"].items()]
    lines += ["", "## Самостоятельная работа", ""]
    for a in topic["assignments"]:
        lines += [f'### {a["id"]}. {a["title"]}', "", f'**Сложность:** {a["difficulty"]}. **Результат:** {a["learning_outcome"]}.', "",
                  a["question"], "", "**Данные:** " + a["data"], "", "**Допущения:** " + a["assumptions"], "",
                  "**Представьте:** " + a["deliverable"], "", "**Опора:** " + source_link(a) + ".", "",
                  "**При проверке:** " + " ".join(a["assessment_focus"]), "",
                  '<details><summary>Подсказка для начала</summary>', "", a["hint"], "", "</details>", "",
                  '<details><summary>Дальше: необязательное усложнение</summary>', "", a["extension"], "", "</details>", ""]
    lines += ["## Вопросы для подготовки к экзамену", "",
              "Банк содержит 20 вопросов по теме. Это набор для подготовки и выбора заданий, "
              "а не требование ответить на все вопросы за одно занятие. "
              "Для нового вопроса сформулируйте объяснение, затем сверяйтесь с указанным разделом. "
              "В расчётах показывайте модель, единицы и смысл результата.", ""]
    for q in topic["questions"]:
        lines += [f'### {q["id"]}', "", f'**Сложность:** {q["difficulty"]}. **Результат:** {q["learning_outcome"]}.', "",
                  q["question"], "", "**Опора:** " + source_link(q) + ".", ""]
        lines += ["**При проверке:** " + " ".join(q["assessment_focus"]), ""]
    lines += ["[Все самостоятельные работы](index.qmd)", ""]
    return "\n".join(lines)


def render_teacher(bank, teacher):
    lines = ["# Решения и критерии для преподавателя", "",
             "Локальный материал. Не переносить в course/ и не добавлять в Git.", "",
             "Каждое задание и вопрос -- до 4 баллов: два критерия по 2. По каждому критерию: "
             "0 -- содержательная часть отсутствует или неверна; 1 -- частично верна, но есть существенный пробел; "
             "2 -- выполнена и обоснована. Арифметическая ошибка при верной модели не обнуляет второй критерий "
             "и не штрафуется повторно в зависимых шагах. Обоснованный альтернативный вариант принимается. "
             "Подсказка не уменьшает баллы; необязательные усложнения не входят в эти 4 балла. "
             "Перевод в отметку и обязательный объём автором пока не утверждены.", ""]
    for t in bank["topics"]:
        lines += [f'## Тема {t["id"]}. {t["title"]}', "", t["limitations"], ""]
        for group in ("assignments", "questions"):
            for x in t[group]:
                ans = teacher["items"][x["id"]]
                lines += [f'### {x["id"]}', "", x["question"], ""]
                if group == "assignments":
                    lines += ["**Данные:** " + x["data"], "", "**Допущения:** " + x["assumptions"], ""]
                lines += ["**Решение / план ответа:** " + ans["expected_answer"], "",
                          "**Критерии:**", ""]
                lines += [f'- {c["points"]} балла: {c["criterion"]}' for c in ans["grading_criteria"]]
                lines += ["", "**Альтернативы:** " + ans["alternatives"], "",
                          "**Типичные ошибки:** " + ans["typical_errors"], "",
                          f'**Покрытие:** {x["learning_outcome"]}; {x["difficulty"]}; {x["type"]}.', "",
                          f'**Источник:** [{x["source"]["section"]}](../../{x["source"]["path"]}).', ""]
    return "\n".join(lines)


def check_site(bank, teacher=None):
    site = ROOT / "course/_site"
    for t in bank["topics"]:
        html = (site / f'self-study/topic-{t["id"]}.html').read_text(encoding="utf-8")
        for x in t["assignments"] + t["questions"]:
            assert x["id"] in html, f'Missing rendered item: {x["id"]}'
            anchor = unquote(source_link(x).rsplit("#", 1)[1][:-1])
            source_html = site / Path(x["source"]["path"].removeprefix("course/")).with_suffix(".html")
            assert f'id="{anchor}"' in source_html.read_text(encoding="utf-8"), f'Missing rendered anchor: {x["id"]}'
    public_data = load(site / "self-study/bank.json")
    assert public_data == bank, "Published JSON differs from validated bank"
    for p in site.rglob("*"):
        if not p.is_file():
            continue
        assert p.name not in {"answers.json", "solutions.md"}, f"Teacher file in site: {p}"
        assert not {"docs", "design"}.intersection(p.relative_to(site).parts), f"Internal directory in site: {p}"
        if p.suffix in {".html", ".json", ".qmd", ".md", ".txt"}:
            text = p.read_text(encoding="utf-8")
            assert "docs/assessment" not in text and '"expected_answer"' not in text, f"Teacher reference in site: {p}"
            if teacher is not None:
                assert teacher["private_marker"] not in text, f"Private marker in site: {p}"


def export(bank):
    for topic in bank["topics"]:
        (BANK.parent / f'topic-{topic["id"]}.qmd').write_text(render_topic(topic), encoding="utf-8")


def check_exports(bank):
    for topic in bank["topics"]:
        path = BANK.parent / f'topic-{topic["id"]}.qmd'
        assert path.read_text(encoding="utf-8") == render_topic(topic), f"Stale page: {path}; run --export"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--teacher", action="store_true", help="Require local teacher keys (never used in CI)")
    parser.add_argument("--export", action="store_true", help="Regenerate student pages from public JSON")
    parser.add_argument("--site", action="store_true", help="Check rendered links and publication boundary after HTML render")
    args = parser.parse_args()
    try:
        bank = load(BANK)
        teacher = load(TEACHER) if args.teacher else None
        ids = validate(bank, teacher)
        if args.export:
            export(bank)
            if teacher is not None:
                (TEACHER.parent / "solutions.md").write_text(render_teacher(bank, teacher), encoding="utf-8")
        check_exports(bank)
        if args.site:
            check_site(bank, teacher)
    except (AssertionError, KeyError, ValueError, TypeError, AttributeError, OSError) as error:
        print(f"Assessment check failed: {error}", file=sys.stderr)
        return 1
    print(f'Assessment check passed: {len(bank["topics"])} topics, {len(ids)} items' + ("; teacher keys checked" if args.teacher else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
