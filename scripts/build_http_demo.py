"""Build a portable Windows x64 executable using an isolated PyInstaller environment."""
import argparse
import hashlib
import importlib.util
import importlib.metadata
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def prepare(destination):
    destination.mkdir(parents=True, exist_ok=True)
    component = (ROOT / 'course/_includes/http-exchange.html').read_text(encoding='utf-8')
    component = component.replace('```{=html}\n', '').replace('```', '').strip()
    component = re.sub(r'\s*<details class="http-actions-import">.*?</details>', '', component, flags=re.S)
    component = component.replace('Браузер отправляет', 'curl отправляет')
    component = component.replace('Остальные поля браузер формирует сам.', 'Остальные поля формирует curl.')
    page = '''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ОПИСиС: настоящий HTTP-обмен</title><link rel="stylesheet" href="base.css"><link rel="stylesheet" href="application-layer.css"></head><body><main>
<div class="local-toolbar"><span>ОПИСиС · локальная демонстрация</span><button type="button" data-stop>Завершить программу</button></div>
<h1>От запроса к странице</h1><p>Адрес → запрос → ответ → обработка HTML. Запрос выполняет системный curl на этом компьютере. Браузер показывает полученные данные.</p><p>Поддерживаются HTTP/HTTPS и ответы до 1 МиБ. Для внешних сайтов нужен доступ к Интернету; доступность зависит от вашей сети и правил сайта.</p><p data-local-status></p>
''' + component + '''<p><a href="licenses.txt" target="_blank" rel="noopener">Лицензии компонентов</a></p></main><script src="local.js" defer></script><script src="http-exchange-model.js" defer></script><script src="http-exchange-ui.js" defer></script></body></html>'''
    (destination / 'index.html').write_text(page, encoding='utf-8')
    for source in ['scripts/http_demo/local.js', 'scripts/http_demo/base.css', 'course/styles/application-layer.css', 'course/interactives/http-exchange-model.js', 'course/interactives/http-exchange-ui.js']:
        shutil.copy2(ROOT / source, destination / Path(source).name)
    notices = 'OPISiS HTTP Demo. Python runtime is bundled without modifications. System curl is used, not distributed.\n\n'
    notices += (ROOT / 'LICENSE').read_text(encoding='utf-8')
    python_license = Path(sys.base_prefix) / 'LICENSE.txt'
    if python_license.is_file():
        notices += '\n\nPYTHON RUNTIME AND INCLUDED LIBRARIES\n\n' + python_license.read_text(encoding='utf-8')
    spec = importlib.util.find_spec('PyInstaller')
    if spec:
        distribution = importlib.metadata.distribution('PyInstaller')
        copying = next(distribution.locate_file(file) for file in distribution.files if file.name == 'COPYING.txt')
        notices += '\n\nPYINSTALLER BOOTLOADER AND RUNTIME HOOKS\n\n' + copying.read_text(encoding='utf-8')
    (destination / 'licenses.txt').write_text(notices, encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare-only', action='store_true')
    args = parser.parse_args()
    staging = ROOT / '.tools/http-demo-bundle'
    web = staging / 'web'
    prepare(web)
    shutil.copy2(ROOT / 'scripts/http_demo/app.py', staging / 'app.py')
    if args.prepare_only:
        print(staging)
        return
    if sys.platform != 'win32':
        raise SystemExit('Build the Windows executable on Windows.')
    subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onefile', '--windowed',
                    '--noupx', '--name', 'OPISiS-HTTP-Demo', '--add-data', f'{web};web',
                    '--distpath', str(ROOT / '.tools/http-demo-dist'), '--workpath', str(ROOT / '.tools/http-demo-pyi'),
                    '--specpath', str(staging), str(staging / 'app.py')], check=True)
    artifact = ROOT / '.tools/http-demo-dist/OPISiS-HTTP-Demo.exe'
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    artifact.with_suffix('.exe.sha256').write_text(f'{digest}  {artifact.name}\n', encoding='ascii')
    shutil.copy2(web / 'licenses.txt', artifact.parent / 'THIRD-PARTY-NOTICES.txt')
    print(f'{artifact}\nSHA256 {digest}')


if __name__ == '__main__':
    main()
