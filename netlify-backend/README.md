

## Admin mini console
- Files in `/admin/index.html` (static) + functions `admin-list-orders` and `admin-update-order`.
- Protect via `ADMIN_TOKEN` environment variable on Netlify.
- Open `/admin/` on your deployed site, paste your token, search orders, and update status or tracking.

### Netlify env:
Set `ADMIN_TOKEN=your-long-random-token` and keep it secret.
