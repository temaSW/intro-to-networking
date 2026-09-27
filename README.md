# ОПИСиС — новая версия курса

Это чистая основа для обновляемого курса ОПИСиС. Учебный материал пока ограничен демонстрацией оформления. Исходники находятся в [GitHub-репозитории](https://github.com/temaSW/intro-to-networking).

- `design/` — локальные внутренние документы; каталог не отслеживается Git и не входит в сайт;
- `course/` — публичный Quarto-сайт;
- `course/style-lab/` — сравнение трёх вариантов оформления одного материала;
- `interactives/` — место для будущих переиспользуемых моделей;
- `scripts/` — локальная проверка, `.github/workflows/` — та же проверка в CI.

Нужны Python 3.11+ и [Quarto CLI](https://quarto.org/docs/get-started/). Дополнительных Python-пакетов пока нет.

```bash
quarto preview course
python scripts/check.py
```

Первая команда запускает локальный просмотр, вторая полностью собирает сайт в `course/_site/`. Workflow GitHub Actions выполняет ту же проверку для push и pull request; push в `main` также отправляет результат на GitHub Pages. Для первой публикации в настройках репозитория нужно выбрать **Settings → Pages → Build and deployment → Source: GitHub Actions**. Адрес сайта: https://temasw.github.io/intro-to-networking/.
