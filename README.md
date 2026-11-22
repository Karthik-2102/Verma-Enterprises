# Verma Enterprises

A full-stack web application for a cyber cafe and digital services business. Customers can browse government, education, printing, ID card, and pension and welfare services, upload their documents, place orders, and track them live. Admins manage orders, services, and revenue from a dedicated control panel. The app also includes free online file tools that need no login.

**Live site:** [https://vermaenterprises.vercel.app/index.html](https://vermaenterprises.vercel.app/index.html)

> This is a private project. All rights reserved.

---

## Features

### Customer side
- **Landing page:** services are visible before login, with Home, About, Services, Tools, and Contact navigation
- **Service catalog:** category filters (Government, Education, Printing, ID Card, Pension & Welfare), service search, and prices shown on each card
- **Authentication:** login and sign-up from a navbar modal
- **Order placement:** multi-file document upload with drag-and-drop and previews
- **Live order tracking:** status updates via polling
- **WhatsApp support button:** one-click contact from every page
- **Auto-logout** after a period of inactivity

### Admin control panel
- **Dashboard:** live stat cards for total, pending, completed, and rejected orders
- **Orders:** search orders by name, service, or status, update the timeline stage of each order, and reject an order with a reason shown to the customer
- **Services:** add services with a name, category, application/form charge, service charge, an auto-calculated total price, and a list of required documents. Search, filter by category, and sort the service list
- **Revenue** overview
- **Activity logs**
- **Profile** and **Logout**

### Account security
- JWT-based authentication
- Passwords hashed with bcrypt
- Name-verified password reset flow
- Change-password route
- Secrets kept in environment variables

### Online Tools (free, no login)
Run in the browser, with libraries loaded from a CDN:
- **Image Resizer** with crop and live dimension preview (JPG, PNG, WEBP, HEIC)
- **Image Compressor**
- **File Converter**
- **PDF Image Compressor** with quality presets and target-size control
- **BG Remover:** redirects to external tools

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (no frameworks) |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| File storage | Cloudinary |
| Auth | JWT, bcrypt |
| File uploads | Multer |
| Email | Nodemailer (Gmail SMTP), Resend |
| Client-side tools | jsPDF, pdf.js, heic2any |
| API testing | Postman |
| Frontend hosting | Vercel |
| Backend hosting | Render |

---

## Project Structure

```
Verma-Enterprises/
├── .github/             # GitHub configuration
├── .postman/            # Postman workspace config
├── .vscode/             # Editor settings
├── backend/
│   ├── config/          # App, database and Cloudinary configuration
│   ├── controllers/     # Route handler logic
│   ├── middleware/      # Auth, upload and other middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # Express routes
│   ├── uploads/         # Temporary upload folder
│   ├── utils/           # Helper functions
│   ├── .env             # Environment variables (not committed)
│   ├── package.json
│   └── server.js        # Backend entry point
├── frontend/
│   ├── admin.html       # Admin panel page
│   ├── admin.js         # Admin panel logic
│   ├── adminstyle.css   # Admin panel styles
│   ├── index.html       # Main customer page
│   ├── script.js        # Main frontend logic
│   ├── style.css        # Main styles
│   ├── tools.js         # Online Tools logic
│   ├── background.jpg
│   └── logo.png
├── postman/             # Postman API collections
├── uploads/
├── .gitignore
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js (v18 or later recommended)
- A MongoDB database (for example MongoDB Atlas)
- A Cloudinary account
- A Gmail account with an App Password (for SMTP) and/or a Resend API key

### Installation

```bash
git clone https://github.com/karthik-2102/Verma-Enterprises.git
cd Verma-Enterprises
npm install
cd backend
npm install
```

### Environment variables

Create a `.env` file inside the `backend/` folder:

```dotenv
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret

EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
RESEND_API_KEY=your_resend_api_key

CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret
```

> Never commit `.env` to Git or share these values publicly.

### Run

```bash
cd backend
node server.js
```

Then open the frontend (`frontend/index.html`) in your browser, or serve it with a local static server.

---

## Deployment

| Part | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |

Set the same environment variables in the Render dashboard for the backend. Make sure the frontend's API base URL points to your Render backend.

---

## Author

**Karthik**, Verma Enterprises
GitHub: [@karthik-2102](https://github.com/karthik-2102)

---

## License

This project is private and proprietary. Unauthorized copying, distribution, or use is not permitted.
