const API_URL = 'http://localhost:3000/api/auth';

const testRegistration = async () => {
    try {
        console.log('--- Testing Registration ---');
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'testuser_' + Math.floor(Math.random() * 1000),
                email: `test${Math.floor(Math.random() * 1000)}@example.com`,
                password: 'securepassword123'
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', data);
    } catch (error) {
        console.error('Error:', error.message);
    }
};

const testLogin = async () => {
    try {
        console.log('\n--- Testing Login ---');
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'test@example.com', // Replace with a real user for local testing
                password: 'securepassword123'
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', data);
    } catch (error) {
        console.error('Error:', error.message);
    }
};

// Uncomment the one you want to test
testRegistration();
// testLogin();
