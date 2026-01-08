<?php
/**
 * Standalone WebSocket Server for CNDQ
 *
 * Uses amphp/websocket-server to provide real-time updates.
 * Also listens on port 8081 for internal HTTP push requests.
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Amp\Http\Server\HttpServer;
use Amp\Http\Server\Request;
use Amp\Http\Server\Response;
use Amp\Http\Server\SocketHttpServer;
use Amp\Http\HttpStatus;
use Amp\Log\ConsoleFormatter;
use Amp\Log\StreamHandler as AmpStreamHandler;
use Amp\Websocket\Server\Websocket;
use Amp\Websocket\Server\WebsocketClientHandler;
use Amp\Websocket\Server\WebsocketClientGateway;
use Amp\Websocket\WebsocketClient;
use Amp\Websocket\Server\Rfc6455Acceptor;
use Monolog\Handler\StreamHandler as MonologStreamHandler;
use Monolog\Logger;
use function Amp\trapSignal;

// 1. Initialize Logging
$dataDir = __DIR__ . '/../data';
if (!file_exists($dataDir) && !is_link($dataDir)) {
    mkdir($dataDir, 0755, true);
}
$logFile = $dataDir . '/websocket.log';

$logHandler = new MonologStreamHandler($logFile);
$logHandler->setFormatter(new ConsoleFormatter());
$logger = new Logger('websocket');
$logger->pushHandler($logHandler);

$stdoutHandler = new AmpStreamHandler(Amp\ByteStream\getStdout());
$stdoutHandler->setFormatter(new ConsoleFormatter());
$logger->pushHandler($stdoutHandler);

// 2. Define the WebSocket Handler
class CndqWebsocketHandler implements WebsocketClientHandler
{
    private WebsocketClientGateway $gateway;
    private array $userToClients = []; 

    public function __construct(WebsocketClientGateway $gateway)
    {
        $this->gateway = $gateway;
    }

    public function handleClient(WebsocketClient $client, Request $request, Response $response): void
    {
        $this->gateway->addClient($client);

        // Try to identify user via X-Remote-User header passed by reverse proxy
        $userEmail = $request->getHeader('X-Remote-User') ?? 'anonymous';
        
        $clientId = $client->getId();
        $this->userToClients[$userEmail][] = $clientId;
        
        $client->sendText(json_encode(['type' => 'connection_established', 'user' => $userEmail]));

        try {
            while ($message = $client->receive()) {
                // We mainly use WS for server-to-client pushes, 
                // but we can handle client-to-server heartbeats here.
                $payload = $message->read();
            }
        } catch (\Amp\Websocket\ClosedException $e) {
            // Normal close
        } finally {
            if (isset($this->userToClients[$userEmail])) {
                $this->userToClients[$userEmail] = array_values(array_filter(
                    $this->userToClients[$userEmail], 
                    fn($id) => $id !== $clientId
                ));
            }
        }
    }

    public function broadcast(string $message, ?array $targetEmails = null): void
    {
        if ($targetEmails === null) {
            $this->gateway->broadcastText($message);
        } else {
            foreach ($targetEmails as $email) {
                if (isset($this->userToClients[$email])) {
                    foreach ($this->userToClients[$email] as $clientId) {
                        $this->gateway->multicastText($message, [$clientId]);
                    }
                }
            }
        }
    }
}

// 3. Setup the Server
$server = SocketHttpServer::createForDirectAccess($logger);

// Listen for WebSockets (External via Reverse Proxy)
$server->expose('127.0.0.1:8080');

// Listen for Internal HTTP Push (Local only)
$server->expose('127.0.0.1:8081');

$gateway = new WebsocketClientGateway();
$wsHandler = new CndqWebsocketHandler($gateway);
$acceptor = new Rfc6455Acceptor();

// 4. Handle Routes
$requestHandler = new \Amp\Http\Server\RequestHandler\ClosureRequestHandler(function (Request $request) use ($wsHandler, $server, $logger, $acceptor): Response {
    // If it's a WebSocket upgrade request
    if ($request->getHeader('upgrade') === 'websocket') {
        return (new Websocket($server, $logger, $acceptor, $wsHandler))->handleRequest($request);
    }

    // Internal HTTP Push API (POST to 127.0.0.1:8081)
    if ($request->getMethod() === 'POST' && $request->getClient()->getLocalAddress()->getPort() === 8081) {
        $body = $request->getBody()->read();
        $data = json_decode($body, true);
        
        if ($data && isset($data['type'])) {
            $recipients = $data['recipients'] ?? null; // Optional list of emails
            $wsHandler->broadcast($body, $recipients);
            return new Response(HttpStatus::OK, ['content-type' => 'application/json'], json_encode(['success' => true]));
        }
        
        return new Response(HttpStatus::BAD_REQUEST, [], 'Invalid payload');
    }

    return new Response(HttpStatus::NOT_FOUND, [], 'Not Found');
});

$errorHandler = new \Amp\Http\Server\DefaultErrorHandler();

// 5. Start the server
$server->start($requestHandler, $errorHandler);

echo "CNDQ WebSocket Server running.\n";
echo "- Port 8080: WebSocket Gateway\n";
echo "- Port 8081: Internal Push API\n";

if (defined('SIGINT')) {
    trapSignal([SIGINT, SIGTERM]);
} else {
    // Fallback for Windows
    $deferred = new \Amp\DeferredFuture();
    $deferred->getFuture()->await();
}

$server->stop();