# OAuth2 Setup Guide for Google and GitHub

This guide will help you set up OAuth2 authentication with Google and GitHub for Wiki.js.

## Overview

Wiki.js already includes built-in OAuth2 support for both Google and GitHub. This guide will walk you through:
1. Setting up OAuth2 applications on Google and GitHub
2. Configuring the authentication strategies in Wiki.js
3. Troubleshooting common issues

## Prerequisites

- A running Wiki.js instance
- Admin access to your Wiki.js installation
- A Google account (for Google OAuth)
- A GitHub account (for GitHub OAuth)

---

## Google OAuth2 Setup

### Step 1: Create a Google OAuth2 Application

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace account)
   - Fill in the required information (App name, User support email, Developer contact)
   - Add scopes: `profile`, `email`, `openid`
   - Save and continue
6. Create the OAuth client:
   - Application type: **Web application**
   - Name: `Wiki.js` (or your preferred name)
   - Authorized redirect URIs: `https://your-wiki-domain.com/login/{strategy-key}/callback`
     - Replace `{strategy-key}` with the actual strategy key you'll use (e.g., `google-oauth`)
     - Example: `https://wiki.example.com/login/google-oauth/callback`
   - Click **Create**
7. **Important**: Copy the **Client ID** and **Client Secret** - you'll need these in Wiki.js

### Step 2: Configure Google OAuth in Wiki.js

1. Log in to your Wiki.js admin panel
2. Navigate to **Administration** > **Authentication**
3. Click **Add Strategy** and select **Google**
4. Fill in the configuration:
   - **Display Name**: `Google` (or your preferred name)
   - **Client ID**: Paste the Client ID from Google Cloud Console
   - **Client Secret**: Paste the Client Secret from Google Cloud Console
   - **Hosted Domain** (optional): If you want to restrict login to a specific Google Workspace domain (e.g., `example.com`), enter it here
5. Configure additional settings:
   - **Self Registration**: Enable if you want new users to be automatically created
   - **Domain Whitelist**: Add allowed email domains (optional)
   - **Auto Enroll Groups**: Select groups to automatically assign to new users
6. Click **Save**

### Step 3: Test Google OAuth

1. Log out of Wiki.js
2. Go to the login page
3. You should see a **Google** option in the authentication providers list
4. Click on it and complete the OAuth flow
5. You should be redirected back to Wiki.js and logged in

---

## GitHub OAuth2 Setup

### Step 1: Create a GitHub OAuth Application

1. Go to your GitHub account settings
2. Navigate to **Developer settings** > **OAuth Apps** (or go directly to [GitHub OAuth Apps](https://github.com/settings/developers))
3. Click **New OAuth App**
4. Fill in the application details:
   - **Application name**: `Wiki.js` (or your preferred name)
   - **Homepage URL**: `https://your-wiki-domain.com`
   - **Authorization callback URL**: `https://your-wiki-domain.com/login/{strategy-key}/callback`
     - Replace `{strategy-key}` with the actual strategy key you'll use (e.g., `github-oauth`)
     - Example: `https://wiki.example.com/login/github-oauth/callback`
5. Click **Register application**
6. **Important**: Copy the **Client ID** and generate a **Client Secret** - you'll need these in Wiki.js

### Step 2: Configure GitHub OAuth in Wiki.js

1. Log in to your Wiki.js admin panel
2. Navigate to **Administration** > **Authentication**
3. Click **Add Strategy** and select **GitHub**
4. Fill in the configuration:
   - **Display Name**: `GitHub` (or your preferred name)
   - **Client ID**: Paste the Client ID from GitHub
   - **Client Secret**: Paste the Client Secret from GitHub
   - **Use GitHub Enterprise**: Enable only if you're using GitHub Enterprise Server
   - **GitHub Enterprise Domain**: Only if using Enterprise (e.g., `github.company.com`)
   - **GitHub Enterprise User Endpoint**: Only if using Enterprise (e.g., `https://api.github.com/user`)
5. Configure additional settings:
   - **Self Registration**: Enable if you want new users to be automatically created
   - **Domain Whitelist**: Add allowed email domains (optional)
   - **Auto Enroll Groups**: Select groups to automatically assign to new users
6. Click **Save**

### Step 3: Test GitHub OAuth

1. Log out of Wiki.js
2. Go to the login page
3. You should see a **GitHub** option in the authentication providers list
4. Click on it and complete the OAuth flow
5. You should be redirected back to Wiki.js and logged in

---

## GitHub Enterprise Setup

If you're using GitHub Enterprise Server, follow these additional steps:

1. In Wiki.js, enable **Use GitHub Enterprise**
2. Enter your **GitHub Enterprise Domain** (e.g., `github.company.com`)
3. Enter your **GitHub Enterprise User Endpoint** (typically `https://github.company.com/api/v3/user`)
4. Create an OAuth application in your GitHub Enterprise instance:
   - Go to your GitHub Enterprise instance
   - Navigate to **Settings** > **Developer settings** > **OAuth Apps**
   - Create a new OAuth app with the callback URL pointing to your Wiki.js instance

---

## Troubleshooting

### Common Issues

#### "Redirect URI mismatch" Error

**Problem**: The redirect URI in your OAuth app doesn't match the one Wiki.js is using.

**Solution**:
1. Check the callback URL in your OAuth application settings
2. The format should be: `https://your-domain.com/login/{strategy-key}/callback`
3. Make sure the strategy key matches exactly (case-sensitive)
4. Ensure there are no trailing slashes or extra characters

#### "Email address is required" Error

**Problem**: The OAuth provider isn't providing an email address.

**Solutions**:
- **Google**: Make sure you've requested the `email` scope in your OAuth consent screen
- **GitHub**: 
  - Ensure your GitHub account has a verified email address
  - Make sure the `user:email` scope is granted (Wiki.js requests this automatically)
  - Check that the email isn't set to private in GitHub settings

#### "Authentication failed" Error

**Problem**: Generic authentication failure.

**Solutions**:
1. Check the Wiki.js server logs for detailed error messages
2. Verify your Client ID and Client Secret are correct
3. Ensure your OAuth application is not disabled
4. Check that the callback URL is correctly configured
5. For Google: Verify the hosted domain setting if you're using one

#### Strategy Not Appearing on Login Page

**Problem**: The OAuth strategy doesn't show up on the login page.

**Solutions**:
1. Make sure the strategy is **enabled** in the admin panel
2. Check that the strategy has a valid configuration (Client ID and Secret)
3. Restart Wiki.js if you just added the strategy
4. Clear your browser cache

#### Domain Restriction Issues (Google)

**Problem**: Users from other domains can't log in when using hosted domain.

**Solution**:
- This is expected behavior when `hostedDomain` is configured
- Only users from the specified domain will be able to authenticate
- Remove the hosted domain setting if you want to allow all Google accounts

### Debugging Tips

1. **Check Server Logs**: Wiki.js logs detailed information about OAuth authentication attempts. Look for messages starting with "Google OAuth:" or "GitHub OAuth:"

2. **Verify OAuth App Settings**: Double-check all settings in your OAuth application match what's configured in Wiki.js

3. **Test with Different Accounts**: Try authenticating with different Google/GitHub accounts to isolate the issue

4. **Check Network**: Ensure your Wiki.js server can reach the OAuth provider's servers (googleapis.com for Google, github.com for GitHub)

5. **HTTPS Requirement**: OAuth2 requires HTTPS in production. Make sure your Wiki.js instance is accessible via HTTPS

---

## Security Best Practices

1. **Keep Secrets Secure**: Never commit Client Secrets to version control
2. **Use HTTPS**: Always use HTTPS in production for OAuth callbacks
3. **Restrict Domains**: Use domain whitelisting if you only want specific email domains
4. **Regular Rotation**: Periodically rotate your OAuth Client Secrets
5. **Monitor Logs**: Regularly check authentication logs for suspicious activity
6. **Limit Scopes**: Only request the minimum required OAuth scopes

---

## Advanced Configuration

### Multiple OAuth Strategies

You can configure multiple instances of the same OAuth provider (e.g., multiple Google strategies) with different settings:
- Different display names
- Different domain restrictions
- Different auto-enroll groups

### Self-Registration vs Manual User Creation

- **Self-Registration Enabled**: New users are automatically created when they first authenticate
- **Self-Registration Disabled**: Only existing users can authenticate (they must be created manually first)

### Domain Whitelisting

You can restrict authentication to specific email domains:
1. Enable **Self Registration**
2. Add domains to **Domain Whitelist** (e.g., `example.com`, `company.org`)
3. Only users with emails from these domains will be able to authenticate

### Auto-Enroll Groups

Automatically assign new users to specific groups:
1. Enable **Self Registration**
2. Select groups in **Auto Enroll Groups**
3. New users will be automatically added to these groups upon first login

---

## Support

If you encounter issues not covered in this guide:

1. Check the [Wiki.js Documentation](https://docs.requarks.io)
2. Review the [GitHub Issues](https://github.com/requarks/wiki/issues)
3. Join the [Wiki.js Discord Community](https://discord.gg/wiki-js)

---

## Recent Enhancements

The OAuth2 implementations have been enhanced with:
- ✅ Better error handling and user-friendly error messages
- ✅ Comprehensive logging for debugging
- ✅ Improved email validation
- ✅ Enhanced profile handling
- ✅ Better domain validation for Google hosted domains

These improvements make it easier to troubleshoot authentication issues and provide better feedback to users.

