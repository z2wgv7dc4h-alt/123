# cos-board.ps1 — launches threaded Python board
param([int]$Port=8787)
$Root='C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio'
$env:COS_BOARD_PORT="$Port"
$py='C:\Users\RIGGUSPIG\AppData\Local\Programs\Python\Python312\python.exe'
& $py (Join-Path $Root 'scripts\cos_board_server.py')
