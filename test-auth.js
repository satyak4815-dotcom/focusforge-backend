const testRegistration = async () => {
    try {
        const response = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'testuser123',
                password: 'securepassword123'
            })
        });
        
        const data = await response.json();
        console.log('Server Status Code:', response.status);
        console.log('Server Response:', data);
    } catch (error) {
        console.error('Error during request:', error.message);
    }
};

testRegistration();
