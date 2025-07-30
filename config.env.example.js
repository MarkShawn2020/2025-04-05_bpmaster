// config.env.example.js
// Copy this file to config.env.js and fill in your actual values
// DO NOT commit config.env.js to version control
//
// Get your Coze token at: https://www.coze.cn/open/oauth/pats

module.exports = {
  // Development environment
  dev: {
    coze: {
      API_URL: 'https://api.coze.cn/v1/workflow/stream_run',
      TOKEN: 'your-dev-token-here',
      WORKFLOW_ID: 'your-dev-workflow-id'
    }
  },
  
  // Production environment  
  prod: {
    coze: {
      API_URL: 'https://api.coze.cn/v1/workflow/stream_run',
      TOKEN: 'your-prod-token-here',
      WORKFLOW_ID: 'your-prod-workflow-id'
    }
  }
};