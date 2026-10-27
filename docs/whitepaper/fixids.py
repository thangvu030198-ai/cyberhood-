# docx-js gives every Bookmark w:id="1"; Word wants unique ids. Renumber start/end pairs in order.
import re, sys, zipfile, shutil, os
src = sys.argv[1]; tmp = src + '.tmp'
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == 'word/document.xml':
            xml = data.decode('utf-8'); n = [0]
            def start(m):
                n[0] += 1
                return m.group(0).replace('w:id="%s"' % m.group(1), 'w:id="%d"' % n[0])
            xml = re.sub(r'<w:bookmarkStart w:name="[^"]*" w:id="(\d+)"/>', start, xml)
            k = [0]
            def end(m):
                k[0] += 1
                return '<w:bookmarkEnd w:id="%d"/>' % k[0]
            xml = re.sub(r'<w:bookmarkEnd w:id="\d+"/>', end, xml)
            assert n[0] == k[0], (n[0], k[0])
            data = xml.encode('utf-8')
        zout.writestr(item, data)
shutil.move(tmp, src)
