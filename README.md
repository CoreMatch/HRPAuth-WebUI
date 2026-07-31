# HRPAuth WebUI
# Requirements
  1.NPM  
  2.Node (>=22 is highly recomended)
# 🚀 Quick Start
## 1. Clone the repository
```bash
git clone https://github.com/CoreMatch/HRPAuth-WebUI.git
cd HRPAuth-WebUI
```
---
## 2. Install dependencies
```bash
npm install
```
---
## 3. Configure HRPAuth API URL
### Production (runtime config)
Edit `public/config.json` (copied to `dist/config.json` on build, editable without rebuilding)
```
{
  "baseUrl": "https://your-hrpauth-api-url.com"
}
```
### Development (Vite proxy target)
Edit `config/backend-dev.json`
```
{
  "baseUrl": "https://your-hrpauth-api-url.com"
}
```
Configure SSL certificate for your HRPAuth API URL  
is HIGHLY RECOMMENDED  
due to:

- Yggdrasil API requirements  
- Security considerations

---
## 4. Start development server
```bash
npm run dev
```
---
## 5. Build for production
```bash
npm run build
```
---
## 6. Preview production build
```bash
npm run preview
```
---
