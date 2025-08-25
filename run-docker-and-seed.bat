@echo off
echo 🚀 Starting Docker containers...
docker-compose -f docker-compose.yaml up -d

echo.
echo ⏳ Waiting for MongoDB to be ready...
timeout /t 10 /nobreak >nul

echo.
echo 🌱 Running seed file...
node seed.js

echo.
echo 🎉 Setup complete! You can now:
echo    - Access the API at: http://localhost:3000
echo    - View Swagger docs at: http://localhost:3000/api/docs
echo    - Access MongoDB Express at: http://localhost:8081
echo    - Login with: admin@example.com / admin123
echo.
echo Press any key to exit...
pause >nul
