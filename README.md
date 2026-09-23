# Congressional-App-Challenge---Votech-Connect
# 🛠️ VoTech Connect - Internal Dev Checklist

## ⚙️ Environment Variables (.env.local)
- [ ] 🔑 `VITE_SUPABASE_URL` / `VITE_FIREBASE_API_KEY`
- [ ] 🔐 `VITE_SUPABASE_ANON_KEY` / `VITE_FIREBASE_PROJECT_ID`
- [ ] 🏫 `GOOGLE_CLASSROOM_CLIENT_ID`

---

## 🎯 Active Coding Tasks

### Phase 1: Models & Database Connection 🏗️
- [ ] 📄 `src/types/models.ts`: Write TypeScript interfaces for `User`, `Project`, and `TradeType`.
- [ ] 🔌 `src/lib/dbClient.js`: Initialize connection client and export database instance.

### Phase 2: Auth & Role Routing 🔑
- [ ] 🛡️ `src/context/AuthContext.jsx`: Build session provider and `@mcvts.org` domain filter.
- [ ] 🚦 `src/components/ProtectedRoute.jsx`: Add role guards for `STUDENT`, `RESIDENT`, and `TEACHER`.

### Phase 3: Matching Engine & APIs 🧮
- [ ] ⚡ `src/lib/bitmaskEngine.js`: Code 24-bit binary AND schedule matching logic.
- [ ] 🔗 `src/lib/googleClassroom.js`: Add OAuth flow and assignment sync helpers.

### Phase 4: Hub Dashboards 📱
- [ ] 👴 `src/pages/SeniorDashboard.jsx`: High-contrast icon category selector.
- [ ] 🎓 `src/pages/StudentDashboard.jsx`: Field hour counter & portfolio display.
- [ ] 🧑‍🏫 `src/pages/TeacherDashboard.jsx`: Safety check-stops & approval queue.
