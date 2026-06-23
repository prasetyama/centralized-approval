# 🚀 Django Production Setup (Gunicorn + Nginx)

Dokumentasi ini menjelaskan langkah-langkah deploy aplikasi **Django** ke production menggunakan **Gunicorn** dan **Nginx**, serta konfigurasi frontend (SPA) yang terhubung ke backend API.

---

# 📦 1. Requirement Server

* Ubuntu Server
* Python 3.x
* Nginx
* Virtualenv

Install dependency:

```bash
sudo apt update
sudo apt install nginx python3-pip python3-venv -y
```

---

# 📁 2. Setup Project Django

```bash
cd /opt/centralized-approval/backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
pip install gunicorn
```

---

# ⚙️ 3. Konfigurasi Django

Edit `settings.py`:

```python
ALLOWED_HOSTS = ['*']  # atau IP/domain server

STATIC_ROOT = os.path.join(BASE_DIR, 'static')
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
```

Collect static:

```bash
python manage.py collectstatic
```

---

# 🔫 4. Jalankan Gunicorn

Test manual:

```bash
gunicorn --bind unix:/opt/centralized-approval/backend/gunicorn.sock config.wsgi:application
```

---

# 🔁 5. Setup Systemd Service

Buat file:

```bash
sudo nano /etc/systemd/system/approval-workflow.service
```

Isi:

```ini
[Unit]
Description=Approval Workflow
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/centralized-approval/backend

Environment="TMPDIR=/opt/centralized-approval/backend"

ExecStart=/opt/centralized-approval/backend/venv/bin/gunicorn \
          --workers 3 \
          --timeout 120 \
          --bind unix:/opt/centralized-approval/backend/gunicorn.sock \
          config.wsgi:application

Restart=always

[Install]
WantedBy=multi-user.target
```

Aktifkan service:

```bash
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl start approval-workflow
sudo systemctl enable approval-workflow
```

---

# 🌐 6. Konfigurasi Nginx (Backend Django)

```bash
sudo nano /etc/nginx/sites-available/approval-workflow
```

```nginx
server {
    listen 80;
    server_name _;

    location = /favicon.ico { access_log off; log_not_found off; }

    location /static/ {
        root /opt/centralized-approval/backend;
    }

    location /media/ {
        root /opt/centralized-approval/backend;
    }

    location / {
        include proxy_params;
        proxy_pass http://unix:/opt/centralized-approval/backend/gunicorn.sock;

        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;

        client_max_body_size 50M;
    }
}
```

Aktifkan:

```bash
sudo ln -s /etc/nginx/sites-available/approval-workflow /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl restart nginx
```

---

# 💻 7. Konfigurasi Nginx Frontend (SPA)

```nginx
server {
    listen 5174;
    server_name _; 

    location / {
        root /path/ke/folder/approval-workflow/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://[IP_ADDRESS]; 
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

👉 Ganti:

* `/path/ke/folder/...` → path build frontend (`dist`)
* `[IP_ADDRESS]` → IP backend Django (contoh: `http://172.16.60.50`)

---

# 🔥 8. Flow Arsitektur

```
Frontend (Port 5174)
        ↓
     Nginx
        ↓ (/api/)
Backend Django (Gunicorn Socket)
        ↓
     Django App
```

---

# 🧪 9. Testing

## Test backend:

```bash
curl --unix-socket /opt/centralized-approval/backend/gunicorn.sock localhost
```

---

# 📊 10. Flow Diagram Workflow Approval

Berikut adalah *Mermaid diagram* yang menggambarkan alur proses dari awal *submit request*, penentuan kondisi *assignee*, hingga proses *approve* atau *reject* beserta *fallback* dan sinkronisasi eksternalnya.

```mermaid
graph TD
    A([Start: API Submit Request]) --> B{Validate Module & Workflow}
    B -- Invalid --> ERR1[Raise ValidationError]
    B -- Valid --> C[Create ApprovalRequest]
    
    C --> D[Loop: Generate Steps from Definition]
    D --> E{Is Brand Conditional?}
    
    %% Brand Logic
    E -- Yes --> F{Payload contains<br/>Master Criteria Key?}
    F -- Yes --> G{Brand Mapped<br/>to Owner?}
    G -- Yes --> H[Assign Step to Brand Owner]
    
    %% Fallback Logic
    F -- No --> I[Fallback to Standard Logic]
    G -- No --> I
    E -- No --> I
    
    I --> J{Approver Type?}
    J -- Specific User --> K[Assign Step to User Required]
    J -- Role Based --> L[Assign to 1st User matching<br/>Role & Division]
    
    %% Condition Evaluation
    H --> M{Evaluate Step Conditions<br/>from Payload}
    K --> M
    L --> M
    
    M -- Conditions Met --> N[Step Status: PENDING]
    M -- Conditions Not Met --> O[Step Status: ADDITIONAL / Skipped]
    
    N --> P[End Loop]
    O --> P
    
    P --> Q{First Valid Step Available?}
    Q -- Yes --> R[Set First Step to WAITING<br/>Status = IN_PROGRESS]
    Q -- No --> S([Status: APPROVED])
    
    R --> ACTION[Wait for User Action]
    
    %% Actions
    ACTION --> T[Action: Approve Step]
    ACTION --> U[Action: Reject Step]
    ACTION --> DEL[Action: Delegate Step]
    
    DEL --> R
    
    T --> V{Is Last Step?}
    V -- No --> W[Activate Next Step to WAITING] --> ACTION
    V -- Yes --> X([Status: APPROVED])
    
    U --> Y([Status: REJECTED])
    
    %% External Notification
    X --> Z[[Notify External System<br/>Webhook/Database Sync]]
    Y --> Z
    
    %% Revise Logic
    Y --> REV[Action: Revise Request<br/>By Original Requester]
    REV --> R2[Reset Workflow State] --> R
```
