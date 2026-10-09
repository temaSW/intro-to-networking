# Сборка и публикация курса

Сайт находится в `course/`. GitHub Actions собирает его и публикует на [GitHub Pages](https://temasw.github.io/intro-to-networking/) после каждого успешного push в `main`. Для pull request workflow выполняет проверки без публикации. Его также можно запустить вручную на ветке `main` через **Actions → Check site → Run workflow**.

## Локальная проверка

Требуются Python 3.11+ и Quarto **1.10.18**. На этой машине Quarto установлен в `%LOCALAPPDATA%\Programs\Quarto-1.10.18` и добавлен в пользовательский `PATH`. Уже открытый терминал может не увидеть новый `PATH`; `scripts/check.py` найдёт эту установку напрямую.

Из корня репозитория:

```powershell
python scripts/check.py
```

Команда проверяет версию Quarto и собирает все страницы в `course/_site/`. На Windows её кэш хранится в игнорируемой папке `.tools/appdata/`, поэтому команда работает и в ограниченном окружении. Перед отправкой изменений проверьте, что команда завершилась с кодом 0. Сгенерированные файлы в Git не добавляют.

## Публикация

После успешной локальной проверки закоммитьте нужные исходники и отправьте `main`. Workflow `.github/workflows/check.yml` выполнит проверки и повторит сборку на Ubuntu с той же версией Quarto, затем опубликует сайт через GitHub Pages. Статус и ссылку на развертывание смотрите в **Actions → Check site**. При сбое любой проверки публикация не запускается.

Ручной повтор публикации текущего `main` через GitHub CLI:

```powershell
gh workflow run "Check site" --ref main
gh run list --workflow "Check site" --limit 1
```

Локальный `quarto publish gh-pages` здесь не нужен: публикацией управляет существующий workflow с артефактом Pages.
