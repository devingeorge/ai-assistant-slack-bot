# 🚀 Deploy Slack Groq Bot to Render

This guide will help you deploy your AI Assistant Slack Bot with Dynamic Action Triggers to Render.

## 📋 Prerequisites

1. **GitHub Repository**: Your code should be pushed to GitHub (✅ Done)
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **Slack App**: Created with the updated manifest
4. **Environment Variables**: API keys and configuration ready

## 🔧 Step 1: Create Render Services

### 1.1 Create Redis Database
1. Go to [render.com/dashboard](https://dashboard.render.com)
2. Click **New** → **Redis**
3. Configure:
   - **Name**: `slack-bot-redis`
   - **Region**: Choose closest to your users
   - **Plan**: Free (for testing) or Starter (for production)
4. Click **Create Redis**
5. **Copy the Redis URL** from the dashboard - you'll need it later

### 1.2 Create Web Service
1. Click **New** → **Web Service**
2. Connect your GitHub repository: `devingeorge/ai-assistant-slack-bot`
3. Configure:
   - **Name**: `slack-groq-bot`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (for testing) or Starter+ (for production)

## 🔑 Step 2: Configure Environment Variables

In your Render web service dashboard, add these environment variables:

### Required Variables
```bash
# Slack Configuration
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret  
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_STATE_SECRET=your-random-secret-string-here

# AI Provider (choose one)
GROK_API_KEY=your-grok-api-key
# OR
XAI_API_KEY=your-xai-api-key  
# OR
GEMINI_API_KEY=your-gemini-api-key

# Database
REDIS_URL=redis://your-render-redis-url-here

# Environment
NODE_ENV=production
```

### ⚠️ Important: SLACK_STATE_SECRET
The `SLACK_STATE_SECRET` is **critical** for OAuth to work properly. It should be:
- A random string (e.g., `my-secret-key-12345-abcdef`)
- **Different from your signing secret**
- **Consistent** across deployments (don't change it once set)
- **At least 16 characters long**

**Generate a secure one:**
```bash
# Option 1: Use openssl
openssl rand -base64 32

# Option 2: Use node
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Use online generator
# Visit: https://www.uuidgenerator.net/
```

### Optional Feature Flags
```bash
# Feature toggles
FEAT_CHANNEL_CONTEXT=true
FEAT_RECENT_MESSAGES=true
FEAT_DATA_ACCESS=true
FEAT_RAG=false

# Memory settings
ASSISTANT_THREAD_TTL_SECONDS=86400
ASSISTANT_CONTEXT_TTL_SECONDS=1800
MEMORY_TURNS=16
MEMORY_TTL_DAYS=14
```

## 🔗 Step 3: Update Slack App Configuration

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Select your app
3. Go to **App Manifest**
4. Replace the URLs in your manifest with your Render service URL:

```json
{
  "features": {
    "slash_commands": [
      {
        "command": "/ask",
        "url": "https://your-service-name.onrender.com/slack/commands"
      },
      {
        "command": "/ticket", 
        "url": "https://your-service-name.onrender.com/slack/commands"
      }
    ]
  },
  "oauth_config": {
    "redirect_urls": [
      "https://your-service-name.onrender.com/slack/oauth_redirect"
    ]
  },
  "settings": {
    "event_subscriptions": {
      "request_url": "https://your-service-name.onrender.com/slack/events"
    },
    "interactivity": {
      "request_url": "https://your-service-name.onrender.com/slack/interactive"
    }
  }
}
```

5. Save the manifest
6. **Reinstall the app** to your workspace to apply new permissions

## 🚀 Step 4: Deploy

1. In Render dashboard, go to your web service
2. Click **Manual Deploy** → **Deploy latest commit**
3. Monitor the build logs for any errors
4. Once deployed, your service will be available at: `https://your-service-name.onrender.com`

## ✅ Step 5: Test Deployment

### Health Check
Visit: `https://your-service-name.onrender.com/health`
Should return: `{"status":"healthy","timestamp":"..."}`

### Slack Integration Tests
1. **App Home**: Visit your app's Home tab in Slack
2. **Direct Message**: Send a DM to your bot
3. **@Mention**: Mention your bot in a channel
4. **Dynamic Triggers**: Try creating and using action triggers
5. **Slash Commands**: Test `/ask` and `/ticket` commands

## 🔧 Troubleshooting

### Common Issues

**1. OAuth State Parameter Error** ❌
```
Error: The state parameter is not for this browser session
```
**Solution:**
- Add `SLACK_STATE_SECRET` environment variable in Render
- Generate a secure random string (see above)
- Redeploy your service
- Try installation again

**2. Build Failures**
- Check Node.js version compatibility in `package.json`
- Ensure all dependencies are properly listed

**3. Environment Variable Issues**
```bash
# Check if variables are set correctly
curl https://your-service-name.onrender.com/health
```

**4. Slack Connection Issues**
- Verify all URLs in manifest match your Render service
- Check signing secret matches exactly
- Ensure app is reinstalled after manifest changes
- **Most importantly**: Ensure `SLACK_STATE_SECRET` is set

**5. Redis Connection**
- Verify `REDIS_URL` is correct
- Check if Redis service is running in Render dashboard

### Debug Logs
Monitor your service logs in Render dashboard:
1. Go to your web service
2. Click **Logs** tab
3. Look for connection/startup errors

### Health Monitoring
Set up monitoring:
1. Use Render's built-in health checks
2. Monitor `/health` endpoint
3. Set up alerts for downtime

## 🎯 Production Recommendations

### Performance
- Use **Starter** plan or higher for production
- Enable **auto-deploy** for continuous deployment
- Set up **custom domain** for professional URLs

### Security
- Use **environment-specific secrets**
- Rotate API keys regularly
- Monitor access logs

### Scaling
- Monitor memory and CPU usage
- Consider upgrading plan based on usage
- Set up **horizontal scaling** if needed

## 📊 Monitoring & Maintenance

### Key Metrics to Monitor
- Response time to Slack events
- Memory usage (Redis and app)
- Error rates in logs
- User engagement with triggers

### Regular Tasks
- Update dependencies monthly
- Monitor API rate limits
- Review and optimize triggers
- Backup critical configurations

---

## 🎉 You're All Set!

Your Slack AI Assistant with Dynamic Action Triggers is now deployed on Render! Users can:

- Create instant-response triggers for common questions
- Use AI assistance for complex queries  
- Manage tickets through Jira integration
- Get context-aware channel summaries

**Next Steps:**
1. Import trigger templates to get started quickly
2. Train users on creating effective triggers
3. Monitor usage and optimize based on feedback

Need help? Check the logs in Render dashboard or review the troubleshooting section above.
