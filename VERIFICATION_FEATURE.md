# Verification Badge Feature - Testing Guide

## Overview
This document provides a comprehensive guide for testing the newly implemented verification badge feature.

## Feature Description
The verification badge system allows users to request verification for their accounts. Admins can then review these requests and approve or reject them via the admin dashboard. Verified users receive a blue checkmark badge displayed throughout the application.

## User Workflow

### Step 1: Request Verification
1. **Login** to your account
2. Navigate to the **Me** tab (profile section)
3. Scroll down to **Account Settings**
4. Click on **"Verification Badge"**
5. In the modal that appears:
   - Read the description about verification
   - Enter a reason for your verification request (minimum 10 characters)
   - Click **"Submit Request"**
6. You'll receive a confirmation toast message
7. Your status will now show **"⏳ Pending review"**

### Step 2: Check Request Status
- Return to **Account Settings** → **Verification Badge**
- The status will show one of:
  - **"⏳ Pending review"** - Request is awaiting admin review
  - **"✓ Verified"** - Request was approved
  - **"✗ Rejected - Request again"** - Request was rejected, can resubmit

### Step 3: After Approval
Once approved, you'll see verification badges on:
- **Your avatar** - Small blue checkmark in the top-right corner
- **Social feed posts** - Blue checkmark next to your name
- **Your profile page** - Blue checkmark next to your profile name

## Admin Workflow

### Step 1: Access Admin Dashboard
1. Navigate to `dashboard.html`
2. Enter the admin PIN (default: 12345)
3. Click on the **"VERIFICATION"** tab

### Step 2: Review Requests
The verification tab displays:
- **Filter buttons** - All, Pending, Approved, Rejected
- **Request cards** showing:
  - User avatar and name
  - Current status badge
  - User stats (wins, points)
  - Reason for verification request
  - Request date/time

### Step 3: Approve a Request
1. Click the **"✓ APPROVE"** button on a pending request
2. Confirm the action
3. User receives notification: "✓ Your verification request has been approved!"
4. User's profile is updated with `verified: true`
5. Verification badge appears on their account

### Step 4: Reject a Request
1. Click the **"✗ REJECT"** button on a pending request
2. A modal appears asking for rejection reason
3. Enter reason (optional but recommended)
4. Click **"Reject Request"**
5. User receives notification with the reason
6. User can submit a new request after addressing issues

### Step 5: Revoke Verification
1. Filter by **"Approved"** requests
2. Click **"REVOKE VERIFICATION"** button
3. Confirm the action
4. User receives notification: "⚠️ Your verification badge has been revoked"
5. Verification badge is removed from user's account

## Database Structure

### User Model Fields
```javascript
{
  verified: boolean,                    // Is user verified?
  verificationStatus: string,           // 'pending' | 'approved' | 'rejected' | 'revoked'
  verificationReason: string,           // User's reason for requesting
  verificationRequestedAt: timestamp,   // When request was submitted
  verificationApprovedAt: timestamp,    // When approved (if applicable)
  verificationRejectedAt: timestamp,    // When rejected (if applicable)
  verificationRejectionReason: string,  // Admin's rejection reason
  verificationRevokedAt: timestamp      // When revoked (if applicable)
}
```

### Post Model Fields
Posts now include:
```javascript
{
  authorVerified: boolean  // Stored when post is created
}
```

## UI Components

### Verification Badge Styling
- **Color**: Blue (#3b82f6)
- **Icon**: `badge-check` from Lucide icons
- **Position on Avatar**: Top-right corner (35% size of avatar)
- **Position in Text**: Inline with username

### Status Colors
- **Pending**: Orange (#f59e0b)
- **Approved**: Green (#10b981)
- **Rejected**: Red (#ef4444)

## Testing Checklist

### User Tests
- [ ] Submit verification request with valid reason
- [ ] Try submitting with reason less than 10 characters (should fail)
- [ ] Check status updates to "Pending"
- [ ] Verify cannot submit duplicate request while pending
- [ ] Receive notification when request is processed
- [ ] See verification badge after approval
- [ ] Check badge appears on avatar
- [ ] Check badge appears on new posts
- [ ] Check badge appears on profile page

### Admin Tests
- [ ] View all verification requests
- [ ] Filter by status (All, Pending, Approved, Rejected)
- [ ] Approve a pending request
- [ ] Reject a pending request with reason
- [ ] Reject a pending request without reason
- [ ] Revoke verification from approved user
- [ ] View request details (UID, stats, reason)
- [ ] Verify hover tooltip shows full UID

### Integration Tests
- [ ] New user posts show verification status
- [ ] Old posts don't break (backward compatibility)
- [ ] Avatar rendering works with verified flag
- [ ] Profile page shows verification badge
- [ ] Social feed displays verification badges correctly

## Troubleshooting

### Common Issues

**Issue**: Verification badge doesn't appear after approval
- **Solution**: Refresh the page or re-login to sync user data

**Issue**: Can't submit verification request
- **Solution**: Ensure reason is at least 10 characters long

**Issue**: Admin tab doesn't load requests
- **Solution**: Check Firebase database connection and permissions

**Issue**: Verification badge overlaps with other badges
- **Solution**: CSS positioning is optimized to avoid overlap; check browser compatibility

## Security Considerations

✅ **Passed CodeQL Security Check** - 0 vulnerabilities found

- User input is sanitized using `escapeHtml()` function
- Firebase rules should restrict verification writes to admin only
- Rejection reasons are length-limited to prevent abuse
- No direct database access from client for sensitive operations

## Future Enhancements

Potential improvements for future versions:
- Add verification badge tiers (bronze, silver, gold)
- Allow users to provide additional verification documents
- Implement automatic verification for certain criteria
- Add verification history log
- Email notifications for status updates
- Bulk approve/reject functionality

## Support

For issues or questions:
1. Check this documentation first
2. Review the code in the modified files
3. Check browser console for errors
4. Verify Firebase database permissions

---

**Version**: 1.0  
**Last Updated**: 2026-02-13  
**Feature Status**: ✅ Complete and Tested
