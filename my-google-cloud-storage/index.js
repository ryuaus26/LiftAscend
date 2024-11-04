// index.js
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const client = new SecretManagerServiceClient();

async function getOpenAIKey() {
    const secretName = 'projects/YOUR_PROJECT_ID/secrets/openai-api-key/versions/latest'; // Replace YOUR_PROJECT_ID

    try {
        const [version] = await client.accessSecretVersion({
            name: secretName,
        });

        const apiKey = version.payload.data.toString('utf8');
        console.log('Retrieved OpenAI API Key:', apiKey);
        return apiKey;
    } catch (error) {
        console.error('Error retrieving secret:', error);
    }
}

getOpenAIKey();
