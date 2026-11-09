"""Check the rendered ARP demonstration against its visible teaching states."""
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

    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT / "course/_site")))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"http://127.0.0.1:{server.server_port}/lectures/09-network-security.html")
            root = page.locator('[data-security-arp]')
            page.wait_for_selector('[data-security-arp][data-ready=true]')
            assert root.evaluate("n=>n.closest('details')===null")
            get = lambda name: root.locator(f'[data-arp="{name}"]')
            def view(name):
                root.locator(f'[data-arp-view="{name}"]').click()
            def event(index):
                return root.locator(f'[data-arp-event="{index}"]')
            view('exchange')
            assert get('exchange').is_visible() and not get('network').is_visible()
            event(1).click()
            assert get('mapping').inner_text() == 'MAC G'
            assert 'ещё хранится MAC G' in get('entry-note').inner_text()
            assert event(1).get_attribute('aria-current') == 'step'
            event(2).focus()
            event(2).press('Enter')
            assert get('mapping').inner_text() == 'MAC X'
            title = get('title').inner_text()
            view('network')
            assert get('title').inner_text() == title
            view('exchange')
            assert get('title').inner_text() == title
            event(4).click()
            get('action').select_option('drop')
            assert 'отбрасывает' in get('last-event').inner_text()
            view('network')
            assert get('dropped').is_visible() and get('action').input_value() == 'drop'
            view('exchange')
            assert event(4).get_attribute('aria-current') == 'step'
            get('reset').click()
            assert get('exchange').is_visible() and get('mapping').inner_text() == 'MAC G'
            view('network')
            assert get('previous').is_disabled()
            assert get('direct').is_visible()
            assert get('mapping').inner_text() == 'MAC G'
            get('next').click()
            assert get('message').is_visible()
            assert get('mapping').inner_text() == 'MAC G'
            get('next').click()
            assert get('mapping').inner_text() == 'MAC X'
            assert not get('toX').is_visible()
            get('next').click()
            assert get('toX').is_visible() and not get('toG').is_visible()
            get('next').click()
            assert get('toG').is_visible()
            assert get('path').inner_text().endswith('S → X → G')
            assert get('next').is_disabled()
            get('action').select_option('drop')
            assert get('dropped').is_visible() and not get('toG').is_visible()
            assert get('path').inner_text().endswith('S → X')
            get('previous').click()
            assert get('toX').is_visible() and not get('dropped').is_visible()
            for theme in ['light', 'dark']:
                page.emulate_media(color_scheme=theme)
                for width, height in [(1920, 1080), (1000, 900), (390, 844), (320, 740), (844, 390)]:
                    page.set_viewport_size({'width': width, 'height': height})
                    for action in ['forward', 'drop']:
                        get('reset').click()
                        for step in range(5):
                            if step >= 3:
                                get('action').select_option(action)
                            for mode in ['network', 'exchange']:
                                title = get('title').inner_text()
                                view(mode)
                                assert get('title').inner_text() == title
                                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (theme, width, step, mode)
                            view('network')
                            assert root.locator('.arp-state-card').nth(1).inner_text().find('R') >= 0
                            if step < 4:
                                get('next').click()
                page.set_viewport_size({'width': 1920, 'height': 1080})
                for step in range(5):
                    get('reset').click()
                    for _ in range(step):
                        get('next').click()
                    root.screenshot(path=str(ROOT / f'.tools/arp-{theme}-{step}.png'))
            view('exchange')
            event(2).click()
            page.set_viewport_size({'width': 1920, 'height': 1080})
            root.screenshot(path=str(ROOT / '.tools/arp-exchange.png'))
            page.set_viewport_size({'width': 320, 'height': 740})
            sequence_scroll = root.locator('.arp-exchange-scroll')
            sequence_scroll.focus()
            sequence_scroll.press('ArrowRight')
            page.wait_for_function('n=>n.scrollLeft>0', arg=sequence_scroll.element_handle(), timeout=2000)
            root.screenshot(path=str(ROOT / '.tools/arp-exchange-mobile.png'))
            view('network')
            page.set_viewport_size({'width': 320, 'height': 740})
            scroll = root.locator('.arp-graph-scroll')
            scroll.focus()
            scroll.press('ArrowRight')
            page.wait_for_function('n=>n.scrollLeft>0', arg=scroll.element_handle(), timeout=2000)
            get('reset').click()
            assert get('direct').is_visible() and not get('message').is_visible()
            assert get('mapping').inner_text() == 'MAC G'
            assert get('action').input_value() == 'forward'
            assert not errors, errors
            browser.close()
        print('PASS: ARP announcement/acceptance/data forwarding, drop/reset, 5 states, themes, layouts, keyboard scroll')
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == '__main__':
    main()
