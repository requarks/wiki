echo "Downloading latest assets..."
wget -q -O noto-emoji.tar.gz https://github.com/googlefonts/noto-emoji/archive/refs/heads/main.tar.gz
echo "Extracting assets..."
tar --strip-components=1 -xzf noto-emoji.tar.gz noto-emoji-main/svg
echo "Building asar..."
npx @electron/asar pack svg noto-emoji.asar
echo "Cleaning up..."
rm -rf svg noto-emoji.tar.gz
echo "Done."
