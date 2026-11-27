@echo off
cd C:\Users\godav\Downloads\E-blood_backend
set NODE_ENV=development
set DB_USER=GODAVID914_SCHEMA_KR9JF
set DB_PASSWORD=KBBF4T1J41KGZ7P73YTY$P2YK3e34I
set DB_CONNECT_STRING=tcps://db.freesql.com:2484/26ai_un3c1
set JWT_ACCESS_SECRET=88c05438ff0b0f1118e43217b2d285542921f4c10c0c095219d1a7a00705b1dc5ea4df9a2258d3208fd73cebd47b420e
set JWT_REFRESH_SECRET=5fcd7731a69b7db5f7933041b6c8c05d93150ec183e9681df40e0ebce9be7da38465acf66e13d144fda8f53e2044c781
set CORS_ORIGINS=*
set PORT=3000
set SMTP_HOST=smtp.gmail.com
set SMTP_PORT=587
set SMTP_SECURE=false
set SMTP_USER=sachinpokharel40k@gmail.com
set SMTP_PASSWORD=pbqjsoiimqfmkuzm
set MAIL_FROM="eBlood Alerts <sachinpokharel40k@gmail.com>"
start /b node dist\app.js
timeout /t 3 /nobreak > nul
echo Server started...