# Bookify User Roles and Permissions

This document provides a comprehensive overview of all user roles within the Bookify platform and the permissions associated with each role.

---

## Table of Contents
1. [Guest Role](#guest-role)
2. [Host Role](#host-role)
3. [Admin Role](#admin-role)

---

## Guest Role

**Description:** Default role for all registered users who browse and book listings on the platform.

### Account Management
- ✅ Create and manage personal account
- ✅ Sign up with email/password or Google authentication
- ✅ Update profile information (name, email, photo)
- ✅ View personal dashboard with statistics
- ✅ Receive welcome bonus points (150 points) upon registration

### Listing Access
- ✅ Browse and search all published listings (Homes, Experiences, Services)
- ✅ View detailed listing information (photos, descriptions, amenities, pricing)
- ✅ Filter listings by category, location, price range, and other criteria
- ✅ Save listings to favorites
- ✅ View saved favorites list
- ✅ Remove listings from favorites

### Booking Management
- ✅ Make bookings for Homes, Experiences, and Services
- ✅ View booking history (past, upcoming, cancelled)
- ✅ Cancel bookings (subject to cancellation policies)
- ✅ Request refunds for cancelled bookings
- ✅ View booking details and status
- ✅ Receive booking confirmation emails
- ✅ Receive cancellation emails with refund information

### Payment & Wallet
- ✅ Access personal E-Wallet
- ✅ Add funds to wallet
- ✅ View wallet balance and transaction history
- ✅ Make payments using wallet balance
- ✅ Make payments via PayPal
- ✅ Receive refunds to wallet
- ✅ View payment history

### Points & Rewards
- ✅ Earn points from bookings (80 points per booking)
- ✅ View points balance
- ✅ Redeem points for rewards
- ✅ View available rewards
- ✅ Apply rewards as discounts during booking
- ✅ View points transaction history

### Communication
- ✅ Send messages to hosts
- ✅ Receive messages from hosts
- ✅ View message history
- ✅ Access guest messages interface

### Reviews & Ratings
- ✅ Write reviews for completed bookings
- ✅ Rate listings (1-5 stars)
- ✅ Add text reviews (up to 1000 characters)
- ✅ View own reviews
- ✅ View reviews from other guests

### Restrictions
- ❌ Cannot create or manage listings
- ❌ Cannot access host dashboard
- ❌ Cannot manage other users' bookings
- ❌ Cannot access admin features
- ❌ Cannot delete or edit listings
- ❌ Cannot process refunds for hosts

---

## Host Role

**Description:** Users who create and manage listings to offer accommodations, experiences, or services.

### Account Management
- ✅ Create host account (after accepting host policies)
- ✅ Complete host setup process (3-step setup for Homes, Experiences, Services)
- ✅ Update host profile information
- ✅ View host dashboard with business statistics
- ✅ Switch between guest and host views

### Listing Management
- ✅ Create new listings (Homes, Experiences, Services)
- ✅ Edit existing listings (title, description, photos, pricing, amenities)
- ✅ Delete listings
- ✅ Publish listings (make visible to guests)
- ✅ Save listings as drafts
- ✅ Change listing status (draft/published)
- ✅ Archive listings
- ✅ Set listing pricing and fees (base price, cleaning fees)
- ✅ Upload and manage listing photos
- ✅ Set listing location and address
- ✅ Configure listing amenities and features
- ✅ Set cancellation policies (Flexible, Moderate, Strict)
- ✅ Create and manage promotional offers
- ✅ Set availability schedules (for Experiences and Services)

### Booking Management
- ✅ View all bookings for own listings
- ✅ Filter bookings (Today, Upcoming, Cancelled)
- ✅ Confirm pending bookings
- ✅ Cancel bookings
- ✅ Process refunds (with percentage selection)
- ✅ View booking details (guest info, dates, payment status)
- ✅ Send booking confirmation emails to guests
- ✅ Send cancellation emails to guests
- ✅ View booking statistics and revenue

### Calendar Management
- ✅ View calendar with all bookings
- ✅ Filter calendar by listing
- ✅ See booking dates and availability
- ✅ Manage availability for Experiences and Services

### Payment & Wallet
- ✅ Access host wallet
- ✅ View earnings from bookings
- ✅ View wallet balance
- ✅ View transaction history
- ✅ Process refunds (deducted from host wallet)
- ✅ Receive payouts from bookings
- ✅ View revenue statistics

### Rewards Management
- ✅ View host rewards dashboard
- ✅ Earn host booking reward points (100 points per booking)
- ✅ View available rewards
- ✅ Redeem rewards

### Communication
- ✅ Send messages to guests
- ✅ Receive messages from guests
- ✅ View message history
- ✅ Access host messages interface

### Reviews Management
- ✅ View reviews for own listings
- ✅ See average ratings and review counts
- ✅ View individual guest reviews

### Restrictions
- ❌ Cannot manage other hosts' listings
- ❌ Cannot access admin features
- ❌ Cannot manage platform-wide settings
- ❌ Cannot view other hosts' bookings
- ❌ Cannot delete user accounts
- ❌ Cannot manage rewards system globally

---

## Admin Role

**Description:** Platform administrators with full system access and management capabilities.

### Authentication & Access
- ✅ Access admin dashboard
- ✅ Admin role verification (via Firebase claims or user document)
- ✅ Automatic redirect to admin dashboard on login
- ✅ Access all admin routes and features

### Dashboard & Analytics
- ✅ View system-wide statistics and KPIs:
  - Total users count
  - Total hosts count
  - Total listings count
  - Total bookings count
  - Total platform revenue
- ✅ Filter statistics by date range (Last 30d, This Month, YTD, All Time)
- ✅ View recent bookings table
- ✅ View top-rated listings
- ✅ View listings that need attention (low ratings)
- ✅ View hosts list with statistics
- ✅ Search and filter data across all sections

### User Management
- ✅ View all guest accounts (`/admin/guests`)
- ✅ View guest details (name, email, bookings count, verification status)
- ✅ Filter guests by verification status
- ✅ Search guests by name or email
- ✅ Sort guests (by name, bookings, creation date)
- ✅ View guest creation dates and last login
- ✅ Export guest data to CSV
- ✅ View guest booking history

### Host Management
- ✅ View all host accounts (`/admin/hosts`)
- ✅ View host details (name, email, verification status, active status)
- ✅ Filter hosts by verification status
- ✅ Filter hosts by active/inactive status
- ✅ Search hosts by name or email
- ✅ Sort hosts (by name, creation date)
- ✅ View host creation dates
- ✅ Export host data to CSV
- ✅ View host listings and performance

### Listing Management
- ✅ View all listings (`/admin/listings`)
- ✅ View listing details (title, category, host, status)
- ✅ Filter listings by category (Homes, Experiences, Services)
- ✅ Filter listings by status (published, draft)
- ✅ Search listings
- ✅ Sort listings
- ✅ Add new listings (`/admin/add-listings`, `/admin/add-experiences`, `/admin/add-services`)
- ✅ Edit existing listings
- ✅ Delete listings
- ✅ Manage listing schedules (`/admin/add-schedules`)
- ✅ Manage listing availability (`/admin/add-availability`)
- ✅ View listing reviews (`/admin/add-reviews`)

### Booking Management
- ✅ View all bookings across the platform (`/admin/bookings`)
- ✅ View booking details (guest, listing, dates, payment, status)
- ✅ Filter bookings by status (pending, confirmed, cancelled)
- ✅ Filter bookings by payment status
- ✅ Search bookings
- ✅ Sort bookings (by date, amount, status)
- ✅ Export booking data to CSV
- ✅ Print booking reports
- ✅ View booking statistics

### Financial Management
- ✅ Access admin wallet (`/admin/wallet`)
- ✅ View total platform revenue
- ✅ View admin wallet balance
- ✅ Monitor all transactions
- ✅ View transaction history
- ✅ Track service fees collected
- ✅ View financial reports

### Rewards Management
- ✅ Access rewards management (`/admin/rewards`)
- ✅ Create and manage reward types
- ✅ Set reward values and discount types
- ✅ Configure reward eligibility
- ✅ View reward usage statistics
- ✅ Manage reward system settings

### Data Export & Reporting
- ✅ Export user data to CSV
- ✅ Export booking data to CSV
- ✅ Export host data to CSV
- ✅ Print reports (bookings, users, listings)
- ✅ Generate PDF reports
- ✅ Download data with date range filters

### System Monitoring
- ✅ Monitor platform activity
- ✅ View system health metrics
- ✅ Track user engagement
- ✅ Monitor booking trends
- ✅ View revenue trends

### Restrictions
- ❌ Cannot delete own admin account (security measure)
- ❌ Cannot modify Firebase security rules (requires backend access)
- ❌ Cannot access source code or deployment settings (requires developer access)

---

## Role Assignment

### Guest Role
- **Default:** All new user registrations start as Guests
- **Automatic:** No approval required

### Host Role
- **Activation:** User must complete host setup process
- **Requirements:** 
  - Accept host policies and terms
  - Complete at least one listing setup (Homes, Experiences, or Services)
- **Storage:** Host status stored in `hosts` collection in Firestore
- **Access:** Users can be both Guest and Host simultaneously

### Admin Role
- **Assignment:** Manual assignment by existing admin or developer
- **Methods:**
  1. Firebase Custom Claims (`admin: true` in token)
  2. User document field (`role: "admin"` or `isAdmin: true`)
- **Email-based:** Some admin emails may be auto-detected during login
- **Access Control:** Admin routes are protected by role verification

---

## Multi-Role Support

Bookify supports users having multiple roles simultaneously:
- **Guest + Host:** Users can be both a guest (booking listings) and a host (managing listings)
- **Guest + Admin:** Admins can also book listings as guests
- **Host + Admin:** Admins can also manage listings as hosts

Role switching is handled through:
- Navigation menu options
- Local storage flags (`isHost`)
- Route-based access control

---

## Security & Access Control

### Route Protection
- Guest routes: Accessible to all authenticated users
- Host routes: Protected by `isHost` flag and host document verification
- Admin routes: Protected by admin role verification (claims or document field)

### Data Access
- **Guests:** Can only access their own bookings, wallet, messages, and profile
- **Hosts:** Can only access their own listings, bookings for their listings, and host-specific data
- **Admins:** Can access all platform data across all users, hosts, listings, and bookings

### Permission Enforcement
- Frontend route guards prevent unauthorized access
- Backend Firestore security rules enforce data access restrictions
- API endpoints verify user roles before processing requests

---

## Notes

- All roles require authentication (users must be logged in)
- Role permissions are enforced both client-side and server-side
- Some features may require additional verification (e.g., email verification)
- Platform policies and terms apply to all roles
- Role-specific features are accessible through dedicated navigation menus

---

*Last Updated: Based on current Bookify codebase analysis*
*Document Version: 1.0*



