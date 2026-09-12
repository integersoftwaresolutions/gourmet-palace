const env=require('../../config/getEnv')();
function getMailProvider(){if(env.resendApiKey)return require('./resend.mail.provider');return require('./smtp.mail.provider')}
module.exports={getMailProvider};
