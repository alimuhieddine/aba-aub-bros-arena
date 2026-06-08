# Role And Sport Permissions

ABA now uses four member roles:

```text
owner
admin
committee
member
```

## Permission Rules

- `owner`
  - assigns member roles
  - assigns committee sport permissions
  - can manage all sports and admin settings

- `admin`
  - can manage all sports
  - can edit formula/settings
  - can review members and activities

- `committee`
  - can manage only assigned sports
  - can create/edit/cancel matches for assigned sports
  - can assign teams and submit results for assigned sports
  - future performance assessment should additionally require playing in that match

- `member`
  - can join matches, log activities, and view profile/rankings

## Required Database Setup

Run:

```sql
-- supabase/member-role-permissions.sql
```

## Bootstrap First Owner

After the migration, set the first owner manually in Supabase SQL Editor:

```sql
update public.members
set role = 'owner'
where email = 'YOUR_EMAIL_HERE';
```

Then open the Admin tab and use Member Roles to assign admins and committee sport permissions.
