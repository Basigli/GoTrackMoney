# Database Backup & Restore Guide

This guide explains how to safely backup and restore the PostgreSQL database used by GoTrackMoney. Since the database runs inside a Docker container, we use Docker commands to extract and inject the data.

## 1. How to Backup the Database

To take a snapshot of your entire database (including all users, expenses, categories, and settings), run this command on your server:

```bash
docker exec -t gotrackmoney_db pg_dumpall -c -U postgres > gotrackmoney_backup_$(date +%Y-%m-%d).sql
```

**What this does:**
- `docker exec -t gotrackmoney_db`: Reaches inside the running database container.
- `pg_dumpall -c -U postgres`: Tells PostgreSQL to dump all data as plain SQL commands.
- `> gotrackmoney_backup_$(date +%Y-%m-%d).sql`: Saves it to a file with today's date (e.g., `gotrackmoney_backup_2026-06-30.sql`).

Keep this `.sql` file somewhere safe!

---

## 2. How to Restore the Database

If you ever move to a new server or accidentally wipe your data, you can easily restore it from your `.sql` backup file.

First, make sure your database container is running (even if it's completely empty). Then, run this command (replace the filename with your actual backup filename):

```bash
cat gotrackmoney_backup_2026-06-30.sql | docker exec -i gotrackmoney_db psql -U postgres
```

**What this does:**
- `cat ...`: Reads the contents of your backup file.
- `| docker exec -i ...`: Pipes that data directly into the database container.
- `psql -U postgres`: Tells PostgreSQL to execute all the commands inside the backup file to rebuild your data.

---

## 3. Automating Backups (Optional)

If you want to create an automatic daily backup, you can add a Cron job to your Linux server.

1. Open your cron editor:
   ```bash
   crontab -e
   ```
2. Add this line to the bottom to run a backup every night at 3:00 AM (saving it to a `/home/pihole/backups` folder):
   ```bash
   0 3 * * * docker exec -t gotrackmoney_db pg_dumpall -c -U postgres > /home/pihole/backups/gotrackmoney_backup_$(date +\%Y-\%m-\%d).sql
   ```
*(Make sure to create the `backups` folder first!)*
