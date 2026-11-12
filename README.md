<div align="center">

# SignageCMS
### Sistem Manajemen Konten Digital Signage Berbasis Web
**Satu dashboard untuk mengelola berbagai layar digital.**

![React](https://img.shields.io/badge/React-Frontend-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=node.js)
![Supabase](https://img.shields.io/badge/Supabase-Database-3FCF8E?logo=supabase)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-black?logo=socketdotio)

</div>

## Tentang SignageCMS
SignageCMS merupakan aplikasi berbasis web untuk mengelola dan mendistribusikan konten multimedia ke perangkat layar digital secara terpusat. Sistem ini dapat digunakan untuk menampilkan informasi, pengumuman, dan promosi digital di lobby, perkantoran, ruang meeting, maupun area publik. Administrator dapat mengelola perangkat, mengunggah media, membuat playlist, serta mengirimkan konten ke layar tujuan melalui dashboard.

## Arsitektur Sistem

```text
                 ADMINISTRATOR
                       |
                       v
              +-------------------+
              |   Admin Dashboard |
              |    React + Vite   |
              +-------------------+
                       |
                 REST API + JWT
                       |
                       v
              +-------------------+
              |   Backend Server  |
              | Node.js + Express |
              +-------------------+
                   |         |
                   v         v
           +-------------+  +-------------+
           |  Supabase   |  |  Socket.IO  |
           | PostgreSQL  |  |  WebSocket  |
           |   Storage   |  |             |
           +-------------+  +-------------+
                                  |
                                  v
                         +------------------+
                         |  Device Client   |
                         | Device Simulator |
                         +------------------+
```
## Fitur Utama
- **Dashboard Admin:** Pengelolaan perangkat dan konten dalam satu halaman.
- **Authentication:** Login administrator menggunakan JWT.
- **Device Management:** CRUD perangkat dan monitoring status Online/Offline.
- **Content Management:** Upload dan pengelolaan gambar serta video.
- **Push Content:** Mengirim konten ke perangkat tertentu secara real-time.
- **Playlist:** Mengatur urutan pemutaran konten multimedia.
- **Device Client:** Menampilkan konten pada layar digital.
- **Real-time Monitoring:** Pembaruan status perangkat menggunakan Socket.IO.
- **Auto Reconnection:** Mendukung koneksi ulang perangkat ketika terputus.

## Teknologi
| Komponen | Teknologi |
|---|---|
| Frontend | React.js, Vite |
| Backend | Node.js, Express.js |
| Database | Supabase PostgreSQL |
| Media Storage | Supabase Storage |
| Authentication | JSON Web Token (JWT) |
| Real-time | Socket.IO |
| API | REST API |
| Device Client | HTML, CSS, JavaScript |

## Struktur Project
```text
signage-cms/
├── admin-dashboard/       # Dashboard administrator
├── backend/               # REST API dan WebSocket server
├── device-simulator.html  # Simulasi perangkat display
├── package.json
└── README.md
```

## Akses Aplikasi Lokal
| Halaman | Alamat |
|---|---|
| Dashboard | http://localhost:5173 |
| Login Admin | http://localhost:5173/login |
| Device Simulator | http://localhost:5173/device-simulator.html |
| Backend | http://localhost:5000 |

**Akun Demo:**
- Email: `admin@signagecms.com`
- Password: `admin123`

## Persyaratan
Node.js, npm, Git, browser modern, dan akun Supabase.

## Instalasi dan Menjalankan Project
**1. Clone repository**
```bash
git clone https://github.com/nurwardani03/signage-cms.git
cd signage-cms
```
**2. Instalasi backend**
```bash
cd backend
npm install
```
Buat file `.env` berdasarkan `.env.example`, kemudian isi konfigurasi Supabase dan JWT.
```cmd
copy .env.example .env
```
**3. Jalankan backend**
```bash
npm run dev
```
**4. Instalasi dan jalankan dashboard** (gunakan terminal baru dari folder utama):
```bash
cd admin-dashboard
npm install
npm run dev
```
**5. Jalankan Device Simulator**

Buka `http://localhost:5173/device-simulator.html` melalui browser. Pastikan backend aktif dan alamat server pada konfigurasi Device Client sudah sesuai.

## Konfigurasi Environment
Contoh konfigurasi backend pada `backend/.env.example`:
```dotenv
PORT=5000
CLIENT_URL=http://localhost:5173
VITE_API_URL=http://localhost:5000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_random_secret
```
Sesuaikan nama variabel dengan source code backend. Jangan unggah `.env` asli atau credential privat ke repository publik.

## Database & Storage
Menggunakan Supabase PostgreSQL dengan tabel utama:
- `devices`: id, nama, lokasi, status, last_seen.
- `contents`: id, judul, tipe, payload, created_at.
- Storage bucket: `signage-contents` untuk file gambar dan video.

## Alur Penggunaan
1. Admin login ke dashboard.
2. Admin menambahkan perangkat display.
3. Device Client menghubungkan perangkat ke backend.
4. Admin mengunggah gambar atau video.
5. Admin memilih perangkat dan mengirimkan konten.
6. Device Client menerima dan menampilkan konten.
7. Status perangkat dipantau secara real-time melalui dashboard.

<div align="center">**SignageCMS — Simplifying Digital Signage Management.**</div>
