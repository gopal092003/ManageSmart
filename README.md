# ManageSmart

ManageSmart is a full-stack web application for managing seats and shift allocations in study libraries. It allows library managers to create a library, configure shifts, allocate students to seats, and manage bookings through a simple dashboard.

The application is built with an offline-first approach. When the internet connection is unavailable, changes are stored locally and synchronized with the server once connectivity is restored.

---

## Features

- Manager authentication using JWT
- Secure password hashing with bcrypt
- One library per manager
- Configurable library shifts
- Automatic seat generation based on library capacity
- Seat booking and allocation
- Update or remove student bookings
- Offline support using IndexedDB
- Automatic synchronization after reconnecting
- Progressive Web App (PWA) support
- WhatsApp reminder integration
- Responsive user interface

---

## Tech Stack

### Frontend

- React 19
- Vite
- React Router
- TanStack React Query
- Axios
- Bootstrap
- React Bootstrap
- Dexie (IndexedDB)
- Zustand
- Vite PWA

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- bcrypt
- CORS

---

## Project Structure

```
ManageSmart/
│
├── frontend/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── styles/
│   └── api.js
│
├── backend/
│   ├── controller/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── lib/
│   └── server.js
│
└── README.md
```

---

## How It Works

1. A manager creates an account.
2. After logging in, the manager registers a library.
3. The manager specifies the library capacity and available shifts.
4. Seats are automatically created based on the capacity.
5. Students can be assigned to available seat shifts.
6. Managers can update or remove bookings whenever required.
7. If the application is offline, changes are stored locally and synchronized automatically when the connection is restored.

---

## Database Design

```
Manager
│
└── Library
      │
      └── Seats
             │
             └── Shifts
                    │
                    └── Student
```

### Collections

#### Manager

- Name
- Email
- Password

#### Library

- Name
- Capacity
- Location
- Quote

#### Seat

- Seat Number
- Shift List

#### Student

- Name
- Roll Number
- Contact
- Email

---

## Offline Support

ManageSmart is designed to remain usable without an active internet connection.

When the application goes offline:

- Existing data is loaded from IndexedDB.
- New bookings are stored locally.
- Updates and deletions are queued.
- The interface reflects changes immediately.
- Pending operations are synchronized automatically when the connection is restored.

---

## API Endpoints

### Authentication

| Method | Endpoint |
|--------|----------|
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |

### Library

| Method | Endpoint |
|--------|----------|
| POST | `/api/library/registerlibrary` |
| GET | `/api/library/me` |

### Seats

| Method | Endpoint |
|--------|----------|
| GET | `/api/seats/:libraryId` |
| GET | `/api/seats/:libraryId/:seatNumber` |
| POST | `/api/seats/:libraryId/:seatNumber/book` |
| PUT | `/api/seats/:libraryId/:seatNumber/book/:shiftName` |
| DELETE | `/api/seats/:libraryId/:seatNumber/book/:shiftName` |

---

## Installation

### Clone the repository

```
git clone https://github.com/gopal092003/ManageSmart.git

cd ManageSmart
```

### Backend

```
cd backend

npm install

npm run dev
```

### Frontend

```
cd frontend

npm install

npm run dev
```

---

## Environment Variables

### Backend

Create a `.env` file inside the `backend` directory.

```env
PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_secret_key

JWT_EXPIRES_IN=7d
```

### Frontend

Create a `.env` file inside the `frontend` directory.

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Screenshots

Add screenshots of the following pages:

- Login
- Signup
- Library Registration
- Dashboard
- Seat Grid
- Seat Details
- Offline Mode

---

## Future Improvements

Some planned improvements include:

- Fee management
- Search and filtering
- Dashboard analytics
- Export reports
- QR code support
- Role-based access control
- Email notifications

---

## Author

**Gopal Gupta**

GitHub: https://github.com/gopal092003

---

## License

This project is licensed under the MIT License.
