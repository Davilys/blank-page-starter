#!/bin/sh
set -eu
cd /home/u973561543/domains/webmarcas.net/public_html
b=/home/u973561543/wm-home-backups/runtime-20261030
mkdir -p "$b"
cp index.html "$b/index.html"
cp .htaccess "$b/htaccess"
cp assets/index-CXBEgGhA.js "$b/index-original.js"
cp assets/index-menu-20261030.js "$b/index-menu.js"
cp assets/index-title-20261030.js "$b/index-title.js"
# Uploaded staging files are committed atomically per file.
cp assets/runtime-fixed.stage assets/index-CXBEgGhA.js.next
mv assets/index-CXBEgGhA.js.next assets/index-CXBEgGhA.js
cp assets/runtime-alias.stage assets/index-menu-20261030.js.next
mv assets/index-menu-20261030.js.next assets/index-menu-20261030.js
cp assets/runtime-alias.stage assets/index-title-20261030.js.next
mv assets/index-title-20261030.js.next assets/index-title-20261030.js
sed s/index-menu-20261030.js/index-CXBEgGhA.js/g index.html > index.html.next
mv index.html.next index.html
cat >> .htaccess <<'HEADERS'

<IfModule mod_headers.c>
  <FilesMatch "^(index\.html|index-CXBEgGhA\.js|index-menu-20261030\.js|index-title-20261030\.js)$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
</IfModule>
HEADERS
rm assets/runtime-fixed.stage assets/runtime-alias.stage
sha256sum index.html assets/index-CXBEgGhA.js assets/index-menu-20261030.js assets/index-title-20261030.js
