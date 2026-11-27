Set-Location C:\Users\godav\Downloads\E-blood_backend
$env:NODE_ENV = 'development'
$env:DB_USER = 'GODAVID914_SCHEMA_KR9JF'
$env:DB_PASSWORD = 'KBBF4T1J41KGZ7P73YTY$P2YK3e34I'
$env:DB_CONNECT_STRING = 'tcps://db.freesql.com:2484/26ai_un3c1'
$env:JWT_ACCESS_SECRET = '88c05438ff0b0f1118e43217b2d285542921f4c10c0c095219d1a7a00705b1dc5ea4df9a2258d3208fd73cebd47b420e'
$env:JWT_REFRESH_SECRET = '5fcd7731a69b7db5f7933041b6c8c05d93150ec183e9681df40e0ebce9be7da38465acf66e13d144fda8f53e2044c781'
$env:CORS_ORIGINS = '*'
$env:PORT = 3000
$env:SMTP_HOST = 'smtp.gmail.com'
$env:SMTP_PORT = 587
$env:SMTP_SECURE = 'false'
$env:SMTP_USER = 'sachinpokharel40k@gmail.com'
$env:SMTP_PASSWORD = 'pbqjsoiimqfmkuzm'
$env:MAIL_FROM = 'eBlood Alerts <sachinpokharel40k@gmail.com>'
Write-Host "Starting server..."
.\dist\app.js