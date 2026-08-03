# 🎯 How Team Profile Hub Works - Complete Flow

## 📱 User Experience Flow

### Scenario 1: New User Signs Up with Google

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: User Opens App                                      │
│  https://us-data-store-grid.vercel.app                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: User Clicks "Sign In / Register"                    │
│  → Auth Modal Opens                                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: User Clicks "Continue with Google"                  │
│  → Redirects to Google Login Page                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Google Login                                         │
│  → User selects their Google account                         │
│  → User grants permissions                                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Supabase Auth Creates Account                       │
│  → auth.users table: New record                              │
│  → profiles table: New record with role = "PENDING"          │
│  → audit_log: Records "user_google_signup"                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 6: User Redirected Back to App                         │
│  → Shows Yellow Banner:                                       │
│     "Account Registration Pending Admin Approval"            │
│  → Member data is HIDDEN                                      │
│  → Only sees banner + sign out option                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 7: Admin Reviews New Registration                      │
│  → Admin sees "User Roles & Approvals" tab                   │
│  → Badge shows "1" pending user                              │
│  → Admin clicks tab                                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 8: Admin Approves User                                 │
│  → Admin clicks "Approve as MEMBER" (or ADMIN)               │
│  → profiles table: role changed from PENDING → MEMBER        │
│  → audit_log: Records "promote_user"                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 9: User Refreshes Page                                 │
│  → Yellow banner disappears                                   │
│  → User can now VIEW all consultant profiles                 │
│  → User can SEARCH, FILTER, and browse members              │
│  → "Add Member" button appears                               │
└─────────────────────────────────────────────────────────────┘
```

---

### Scenario 2: Member Proposes Editing a Profile

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Member (Normal User) Browses Profiles               │
│  → Sees all 6+ consultant profiles                           │
│  → Clicks on a profile card to view details                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Member Clicks "Propose Edit"                        │
│  → Profile details slide-over panel opens                    │
│  → Button says "Propose Edit" (not "Edit")                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Member Makes Changes                                │
│  → Edit modal opens with all fields                          │
│  → Blue info alert: "Your change will be submitted           │
│     to the Admin Approval queue"                             │
│  → Member edits: name, email, visa type, etc.               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Member Clicks "Submit for Approval"                 │
│  → Modal closes                                               │
│  → Toast notification: "Change proposal submitted"           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Backend Saves to pending_changes Table              │
│  → change_type: "update"                                      │
│  → target_member_id: 1 (the profile being edited)           │
│  → payload: { name: "New Name", visa_type: "H-1B", ... }   │
│  → submitted_by: member's user ID                            │
│  → status: "pending"                                          │
│  → audit_log: Records "submit_pending_change"               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Admin Sees Notification                             │
│  → Navigation bar: "Pending Approvals" badge shows "1"      │
│  → Admin clicks "Pending Approvals" tab                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 7: Admin Reviews Change                                │
│  → Pending approval card shows:                              │
│     - Badge: PENDING                                          │
│     - Type: [UPDATE]                                          │
│     - Profile: "Nirav Patel"                                 │
│     - Submitted by: member@example.com                       │
│  → BEFORE/AFTER DIFF VIEW:                                   │
│     ┌────────────────────────────────────────┐              │
│     │ visa_type:                             │              │
│     │  - H-1B             (red, removed)     │              │
│     │  + U.S. Citizen     (green, added)     │              │
│     │                                         │              │
│     │ last_company:                          │              │
│     │  - Centene          (red, removed)     │              │
│     │  + NBCUniversal     (green, added)     │              │
│     └────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 8: Admin Makes Decision                                │
│                                                               │
│  OPTION A: APPROVE                                           │
│  → Admin clicks "Approve & Apply"                            │
│  → Backend updates members table with new data               │
│  → pending_changes: status = "approved"                      │
│  → audit_log: Records "approve_change" with before/after    │
│  → Member sees updated data immediately                      │
│  → Toast: "Change approved and applied successfully"         │
│                                                               │
│  OPTION B: REJECT                                            │
│  → Admin clicks "Reject"                                     │
│  → Modal asks for rejection reason (optional)                │
│  → pending_changes: status = "rejected"                      │
│  → audit_log: Records "reject_change"                        │
│  → NO change made to members table                           │
│  → Member sees rejection in their Pending tab                │
└─────────────────────────────────────────────────────────────┘
```

---

### Scenario 3: Admin Directly Edits (No Approval Needed)

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Admin Clicks on Profile                             │
│  → Profile panel opens                                        │
│  → Buttons say "Edit" and "Delete" (not "Propose")          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Admin Makes Changes                                 │
│  → Edit modal opens                                           │
│  → NO info alert (admin doesn't need approval)              │
│  → Admin edits fields                                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Admin Clicks "Save Member"                          │
│  → Data saved DIRECTLY to members table                      │
│  → pending_changes table is SKIPPED entirely                │
│  → audit_log: Records "update_member" immediately           │
│  → Changes are LIVE instantly                                │
│  → Toast: "Member updated directly!"                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Role Permissions Matrix

| Action | GUEST | PENDING | MEMBER | ADMIN |
|--------|-------|---------|--------|-------|
| View profiles | ✅ | ❌ | ✅ | ✅ |
| Search/Filter | ✅ | ❌ | ✅ | ✅ |
| Propose Add Member | ❌ | ❌ | ✅ | — |
| Propose Edit Member | ❌ | ❌ | ✅ | — |
| Propose Delete Member | ❌ | ❌ | ✅ | — |
| Direct Add Member | ❌ | ❌ | ❌ | ✅ |
| Direct Edit Member | ❌ | ❌ | ❌ | ✅ |
| Direct Delete Member | ❌ | ❌ | ❌ | ✅ |
| View Pending Approvals | ❌ | ❌ | ✅ (own only) | ✅ (all) |
| Approve/Reject Changes | ❌ | ❌ | ❌ | ✅ |
| View Activity Log | ❌ | ❌ | ❌ | ✅ |
| Manage Users | ❌ | ❌ | ❌ | ✅ |
| Approve New Users | ❌ | ❌ | ❌ | ✅ |
| Promote Users | ❌ | ❌ | ❌ | ✅ |

---

## 🗂️ Database Tables Structure

### 1. auth.users (Supabase Built-in)
```
id                | UUID (primary key)
email             | TEXT
encrypted_password| TEXT
...
```

### 2. profiles
```
id          | UUID → auth.users(id)
email       | TEXT
name        | TEXT
role        | TEXT (ADMIN, MEMBER, PENDING, GUEST)
created_at  | TIMESTAMP
updated_at  | TIMESTAMP
```

### 3. members (Consultant Profiles)
```
id                    | BIGINT (auto-increment)
name                  | TEXT
gmail                 | TEXT
phone                 | TEXT
visa_type             | TEXT
work_authorization    | TEXT
last_company          | TEXT
tech_stack            | TEXT
... (50+ fields)
created_at            | TIMESTAMP
updated_at            | TIMESTAMP
```

### 4. pending_changes
```
id                 | BIGINT (auto-increment)
change_type        | TEXT (create, update, delete)
target_member_id   | BIGINT → members(id)
payload            | JSONB (the proposed changes)
submitted_by       | UUID → auth.users(id)
submitted_by_email | TEXT
submitted_at       | TIMESTAMP
status             | TEXT (pending, approved, rejected)
reviewed_by        | UUID → auth.users(id)
reviewed_at        | TIMESTAMP
admin_note         | TEXT
```

### 5. audit_log
```
id            | BIGINT (auto-increment)
action_type   | TEXT (create_member, approve_change, etc.)
actor         | TEXT (email of person who did action)
target_record | TEXT (ID of affected record)
before_value  | JSONB (data before change)
after_value   | JSONB (data after change)
timestamp     | TIMESTAMP
```

---

## 🔐 Security Layers

### Layer 1: Row-Level Security (RLS)
```sql
-- profiles table
- Anyone can SELECT (read)
- Users can UPDATE own profile (but not the role field)
- Only service role can INSERT/DELETE

-- members table  
- Anyone can SELECT (read)
- Only service role can INSERT/UPDATE/DELETE

-- pending_changes table
- Authenticated users can INSERT
- Users can SELECT own records
- Only service role can UPDATE (approve/reject)

-- audit_log table
- Only service role can INSERT
- Only admins can SELECT
```

### Layer 2: Middleware (Backend)
```javascript
optionalAuth  → Allows guest, enriches with user if logged in
requireAuth   → Returns 401 if not logged in
requireAdmin  → Returns 403 if not ADMIN role
```

### Layer 3: Frontend UI
```javascript
// Hide/show elements based on role
if (role === 'PENDING') {
  hideAllMembers();
  showPendingBanner();
}

if (role === 'ADMIN') {
  showDirectEditButtons();
} else {
  showProposeEditButtons();
}
```

### Layer 4: Rate Limiting
```
Auth endpoints: 20 requests / 15 minutes
General API: 300 requests / 15 minutes
```

---

## 📊 Data Flow Summary

```
USER INPUT (Frontend)
        ↓
   AUTH CHECK (Middleware)
        ↓
   ROLE CHECK (RBAC)
        ↓
┌───────┴────────┐
│     ADMIN?     │
└───────┬────────┘
        │
   ┌────┴─────┐
   │          │
  YES        NO
   │          │
   ↓          ↓
DIRECT     PENDING
WRITE      WRITE
   │          │
   ↓          ↓
members   pending_changes
table     table
   │          │
   │          ↓
   │     ADMIN REVIEW
   │          │
   │     ┌────┴─────┐
   │     │          │
   │    APPROVE   REJECT
   │     │          │
   │     ↓          ↓
   └──> members   (no change)
        table
   │
   ↓
AUDIT LOG
(all actions)
```

---

## 🎯 Key Features Summary

✅ **Google OAuth** - Works on all devices, any browser  
✅ **Role-Based Access** - ADMIN, MEMBER, PENDING, GUEST  
✅ **User Approval** - New signups need admin approval  
✅ **Change Approval** - Member edits need admin approval  
✅ **Diff View** - Before/after comparison for changes  
✅ **Audit Trail** - Every action is logged with details  
✅ **Real-time Updates** - Changes reflect immediately  
✅ **Responsive Design** - Works on desktop, tablet, mobile  
✅ **Offline Fallback** - Demo mode when no database  
✅ **Security Hardened** - RLS, middleware, rate limiting  

---

**This is a production-ready, enterprise-grade profile management system! 🚀**
