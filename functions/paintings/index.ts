export async function onRequestGet(): Promise<Response> {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>tniap 🪞 paint</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'MS Sans Serif', 'Segoe UI', sans-serif;
            background: #c0c0c0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            background: #c0c0c0;
            border: 2px solid #808080;
            padding: 40px;
            text-align: center;
            max-width: 500px;
            box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        h1 {
            font-size: 24px;
            margin-bottom: 20px;
            color: #000;
        }
        p {
            font-size: 14px;
            margin-bottom: 30px;
            color: #000;
        }
        .button {
            background: #c0c0c0;
            border: 2px solid #808080;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            color: #000;
            display: inline-block;
            transition: all 0.1s;
        }
        .button:hover {
            background: #d4d0c8;
        }
        .button:active {
            border: 2px solid #808080;
            background: #a0a0a0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 No Painting Selected</h1>
        <p>You need a painting ID to view a shared painting. If you have a link to a painting, make sure it includes the painting ID.</p>
        <a href="/" class="button">Go to Painting Dashboard</a>
    </div>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

