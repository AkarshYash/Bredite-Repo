# Test Accounts

## Admin Account
**Email**: `chaturvediakarsh51@gmail.com`  
**Password**: `Jaipur@777`  
**Role**: ADMIN

- Can access all features
- Can approve/reject member changes
- Can view audit logs
- Can manage users

## Member Account
**Email**: `akarsh.c@brudite.com`  
**Password**: `Jaipur@123`  
**Role**: MEMBER

- Can view member data
- Can submit changes for approval
- Standard member access
- Cannot approve changes

## How to Use

1. Go to: https://us-data-store-grid.vercel.app/auth.html
2. Enter one of the emails above
3. Enter the corresponding password
4. Click "Sign In"

## Creating New Accounts

1. Click "Create Account" on the login page
2. Fill in:
   - Full Name
   - Email address
   - Password (minimum 8 characters)
   - Agree to Terms
3. New accounts get **PENDING** role by default
4. Admin must approve them to become **MEMBER**

## Auto-Assigned Roles

The system automatically assigns roles based on email:
- `chaturvediakarsh51@gmail.com` → **ADMIN**
- `akarsh.c@brudite.com` → **MEMBER**
- All other emails → **PENDING** (awaiting approval)
