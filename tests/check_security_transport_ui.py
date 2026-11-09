"""Check the rendered TCP-state and UDP-reflection demonstrations."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def main():
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT / 'course/_site')))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/lectures/09-network-security.html')
            tcp = page.locator('[data-security-tcp]')
            udp = page.locator('[data-security-reflection]')
            story = page.locator('[data-tcp-story]')
            page.wait_for_selector('[data-tcp-story][data-ready=true]')
            sg = lambda key: story.locator(f'[data-ts="{key}"]')
            page.wait_for_selector('[data-security-tcp][data-ready=true]', state='attached')
            page.wait_for_selector('[data-security-reflection][data-ready=true]')
            tg = lambda key: tcp.locator(f'[data-tcp="{key}"]')
            ug = lambda key: udp.locator(f'[data-rf="{key}"]')
            assert story.evaluate("n=>n.closest('details')===null")
            assert not tcp.is_visible(), 'advanced controls initially closed'
            for scene, last, expected in [(0, 3, '0 / 6'), (1, 4, '0 / 6'), (2, 4, '6 / 6'), (3, 4, '0 / 6')]:
                story.locator(f'[data-ts-scene="{scene}"]').click()
                assert sg('used').inner_text() == '0 / 6'
                sg('next').click()
                assert sg('used').inner_text() == ('0 / 6' if scene == 3 else '2 / 6' if scene == 2 else '1 / 6')
                for _ in range(last - 1):
                    sg('next').click()
                assert sg('used').inner_text() == expected
                if scene == 0:
                    assert sg('ack').is_visible()
                if scene == 1:
                    assert 'Тайм-аут' in sg('tableNote').inner_text()
                if scene == 2:
                    assert 'Не принят' in sg('probe').inner_text()
                if scene == 3:
                    assert sg('ack').is_visible()
                    assert 'Метка вернулась' in sg('ackNote').inner_text()
                    assert sg('establishedCount').inner_text() == 'Да'
                    assert not sg('burst').is_visible()
                assert sg('next').is_disabled()
                sg('previous').click()
                assert sg('next').is_enabled()
                if scene == 3:
                    assert sg('establishedCount').inner_text() == 'Пока нет'
                    assert not sg('ack').is_visible()
            tcp.evaluate("n=>n.closest('details').open=true")
            assert udp.evaluate("n=>n.closest('details')===null")
            assert tg('time').inner_text() == '0 с'
            page.wait_for_timeout(1100)
            assert tg('time').inner_text() == '0 с', 'no autoplay'
            for _ in range(3):
                tg('step').click()
            assert int(tg('established').inner_text()) > 0
            assert int(tg('used').inner_text().split('/')[0]) < 120
            tg('complete-number').fill('0')
            for _ in range(9):
                tg('step').click()
            assert tg('used').inner_text() == '120 / 120'
            assert 'Не принят' in tg('probe').inner_text()
            assert int(tg('rejected').inner_text()) > 0
            assert ug('counter').inner_text() == '1 / 4', 'independent scenes'
            page.set_viewport_size({'width': 1920, 'height': 1080})
            tcp.screenshot(path=str(ROOT / '.tools/tcp-full-light.png'))
            tg('protection').check()
            assert tg('time').inner_text() == '0 с'
            for _ in range(9):
                tg('step').click()
            assert tg('used').inner_text() == '0 / 120'
            assert 'Не принято: 0' in tg('probe-count').inner_text()
            assert int(tg('synAck').inner_text()) > 0
            tg('complete-number').fill('100')
            assert tg('complete').input_value() == '100'
            assert tg('time').inner_text() == '0 с'
            tg('play').click()
            page.wait_for_function("document.querySelector('[data-tcp=time]').textContent!=='0 с'")
            tg('pause').click()
            time = tg('time').inner_text()
            page.wait_for_timeout(1200)
            assert tg('time').inner_text() == time
            tg('play').click()
            tg('timeout-number').fill('8')
            assert tg('play').is_enabled() and tg('pause').is_disabled()
            assert tg('time').inner_text() == '0 с'
            tg('step').click()
            tg('reset').click()
            assert tg('used').inner_text() == '0 / 120'
            for _ in range(3):
                ug('next').click()
            assert '512 кбит/с' in ug('load').inner_text()
            assert 'превышает ёмкость' in ug('load').inner_text()
            ug('count-number').fill('6')
            assert '384 кбит/с' in ug('load').inner_text()
            assert 'не превышает' in ug('load').inner_text()
            ug('previous').click()
            assert ug('response').is_visible()
            assert not ug('many').is_visible()
            ug('reset').click()
            assert not ug('many').is_visible()
            assert not ug('request').is_visible()
            for theme in ['light', 'dark']:
                page.emulate_media(color_scheme=theme)
                for width, height in [(1920, 1080), (1000, 900), (390, 844), (320, 740), (844, 390)]:
                    page.set_viewport_size({'width': width, 'height': height})
                    for scene, length in [(0, 4), (1, 5), (2, 5), (3, 5)]:
                        story.locator(f'[data-ts-scene="{scene}"]').click()
                        for event in range(length):
                            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (theme, width, scene, event)
                            if event < length - 1:
                                sg('next').click()
                    for step in range(4):
                        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (theme, width, step)
                        if step < 3:
                            ug('next').click()
                    ug('reset').click()
                page.set_viewport_size({'width': 1920, 'height': 1080})
                for scene, length in [(0, 4), (1, 5), (2, 5), (3, 5)]:
                    story.locator(f'[data-ts-scene="{scene}"]').click()
                    for _ in range(length - 1):
                        sg('next').click()
                    story.screenshot(path=str(ROOT / f'.tools/tcp-story-{theme}-{scene}.png'))
                tg('protection').uncheck()
                tg('complete-number').fill('0')
                tg('timeout-number').fill('10')
                for _ in range(9):
                    tg('step').click()
                tcp.screenshot(path=str(ROOT / f'.tools/tcp-full-{theme}.png'))
                for _ in range(3):
                    ug('next').click()
                udp.screenshot(path=str(ROOT / f'.tools/udp-reflection-{theme}.png'))
                ug('reset').click()
            page.set_viewport_size({'width': 320, 'height': 740})
            ug('next').focus()
            page.keyboard.press('Enter')
            assert ug('request').is_visible()
            assert not errors, errors
            browser.close()
        print('PASS: four TCP teaching cases, separate advanced flow, exhaustion/protection, play-pause/reset, UDP, themes/layouts/keyboard')
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == '__main__':
    main()
