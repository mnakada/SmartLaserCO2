rmdir /s /q .\build
rmdir /s /q .\dist

pyinstaller --onefile app.spec
