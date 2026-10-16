"""Quét nhanh chữ chưa dịch: mở từng màn hình qua deep link, lấy chữ đang hiện (uiautomator dump),
in ra các chuỗi còn dấu tiếng Việt. Không cần chụp ảnh → rất ít token.

Cách dùng (máy đã cắm adb, app đang để English):
    python scripts/i18n-scan.py              # quét danh sách màn hình mặc định
    python scripts/i18n-scan.py stats budgets  # chỉ quét vài màn hình

Chuỗi lặp ở nhiều màn hình chỉ in một lần. Dữ liệu người dùng (tên ví, tiêu đề giao dịch…) cũng
có thể hiện ra — hãy tự nhận biết, không phải mọi dòng đều là lỗi.
"""
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ADB = os.path.expandvars(r'%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe')
DEVICE = os.environ.get('JWP_DEVICE', 'L2E0222611010366')
PACKAGE = 'com.jungnguyen.jwp'
VN = re.compile(r'[ạảãàáâậầấẩẫăắằặẳẵéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđĐ]')

ROUTES = [
    '', 'transactions', 'schedule', 'more', 'stats', 'budgets', 'accounts', 'categories', 'tags',
    'debts', 'goals', 'report', 'recurring', 'backup', 'settings/appearance', 'settings/capture',
    'settings/notifications', 'capture-rules', 'inbox', 'schedules', 'receipt-scan', 'import/ivy',
    'transaction/new', 'budget/edit', 'goal/edit', 'tags/suggest',
]


def adb(*args, binary=False):
    out = subprocess.run([ADB, '-s', DEVICE, *args], capture_output=True)
    return out.stdout if binary else out.stdout.decode('utf-8', 'replace')


def texts_on_screen():
    adb('shell', 'uiautomator', 'dump', '/sdcard/scan.xml')
    xml = adb('exec-out', 'cat', '/sdcard/scan.xml', binary=True).decode('utf-8', 'replace')
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []
    found = []
    for node in root.iter('node'):
        for attr in ('text', 'content-desc'):
            value = node.attrib.get(attr, '').strip(' ,')
            if value and VN.search(value):
                found.append(value)
    return found


def main():
    routes = sys.argv[1:] or ROUTES
    seen = set()
    for route in routes:
        adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', f'jwp://{route}', PACKAGE)
        time.sleep(2.5)
        new = [t for t in dict.fromkeys(texts_on_screen()) if t not in seen]
        seen.update(new)
        print(f'## {route or "(home)"}: {len(new)}')
        for t in new:
            print('  ', t)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
