const env=require('../../config/env');
function getMailProvider(){if(env.resendApiKey)return require('./resend.mail.provider');return require('./smtp.mail.provider')}
module.exports={getMailProvider};
