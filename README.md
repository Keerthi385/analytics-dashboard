# 📊 Flowbit Analytics Dashboard

An interactive analytics dashboard built as part of the **Flowbit Full Stack Developer Internship Assignment**.  
This project demonstrates end-to-end implementation of a modular full-stack analytics platform with a clean architecture, responsive UI, and a scalable backend.

---

## 🚀 Tech Stack

### Frontend (`apps/web`)
- **Next.js 14** with **React 18**
- **Tailwind CSS** for responsive design
- **Recharts / Chart.js** for data visualization
- **TypeScript** for type safety
- **Framer Motion** for smooth animations

### Backend (`apps/api`)
- **Next.js API Routes**
- **Prisma ORM** for database management
- **PostgreSQL** as the primary database
- **Node.js** runtime environment
- **Turborepo** for monorepo structure and build optimization

---

## 🧱 Project Structure

analytics-dashboard/
│
├── apps/
│ ├── api/ # Backend (Next.js API + Prisma)
│ └── web/ # Frontend (Next.js + Tailwind)
│
├── prisma/ # Database schema and migrations
├── package.json
├── turbo.json # Turborepo configuration
└── README.md


---

## ⚙️ Setup Instructions

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/Keerthi385/analytics-dashboard.git
cd analytics-dashboard
```

### 2️⃣ Install Dependencies
```
npm install
```

### 3️⃣ Configure Environment Variables
```
Create a .env file at the root of your project and add:

DATABASE_URL=your_postgresql_connection_string


When deploying to Vercel, set this variable under
Vercel → Project → Settings → Environment Variables
```
### 4️⃣ Run Database Migrations
```
npx prisma migrate deploy
```
### 5️⃣ Run the Development Server
```
npm run dev


Your app will start at:

Frontend → http://localhost:3000

API → http://localhost:4000
```
### 🧩 Features
```
📈 Interactive analytics dashboard

🔍 Real-time data visualization

⚙️ Modular and maintainable architecture

🗃️ Prisma ORM integration

🧑‍💻 Full-stack TypeScript implementation
```
### 📬 Submission Info
```
Internship: Flowbit Private Limited — Full Stack Developer Internship

Developer: Bodige Keerthi

GitHub Repository: https://github.com/Keerthi385/analytics-dashboard

🛠️ Commands Summary
Command	Description
npm install	Install dependencies
npm run dev	Run frontend and backend locally
npx prisma migrate deploy	Apply migrations
npx prisma generate	Generate Prisma client
vercel --prod	Deploy production build

```
---


