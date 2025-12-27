<?php
/**
 * Advertisement Manager
 * Teams post interest to buy or sell (no prices)
 */

class AdvertisementManager {
    private $teamEmail;
    private $teamName;
    private $dataDir;

    public function __construct($teamEmail, $teamName = null) {
        $this->teamEmail = $teamEmail;
        $this->teamName = $teamName;
        $this->dataDir = __DIR__ . '/../data/teams/' . $this->sanitizeEmail($teamEmail);

        if (!is_dir($this->dataDir)) {
            mkdir($this->dataDir, 0755, true);
        }
    }

    private function sanitizeEmail($email) {
        return preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $email);
    }

    /**
     * Get team's advertisements
     */
    public function getAdvertisements() {
        $filePath = $this->dataDir . '/advertisements.json';

        if (!file_exists($filePath)) {
            return [];
        }

        $data = json_decode(file_get_contents($filePath), true);
        return $data['ads'] ?? [];
    }

    /**
     * Post advertisement
     */
    public function postAdvertisement($chemical, $type) {
        if (!in_array($chemical, ['C', 'N', 'D', 'Q'])) {
            throw new Exception('Invalid chemical');
        }

        if (!in_array($type, ['buy', 'sell'])) {
            throw new Exception('Invalid type');
        }

        $filePath = $this->dataDir . '/advertisements.json';

        $data = file_exists($filePath)
            ? json_decode(file_get_contents($filePath), true)
            : ['ads' => []];

        $ad = [
            'id' => 'ad_' . time() . '_' . bin2hex(random_bytes(4)),
            'teamId' => $this->teamEmail,
            'teamName' => $this->teamName ?? $this->teamEmail,
            'chemical' => $chemical,
            'type' => $type,
            'status' => 'active',
            'createdAt' => time()
        ];

        $data['ads'][] = $ad;
        $data['lastModified'] = time();

        file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT));

        return $ad;
    }

    /**
     * Remove advertisement
     */
    public function removeAdvertisement($adId) {
        $filePath = $this->dataDir . '/advertisements.json';

        if (!file_exists($filePath)) {
            return false;
        }

        $data = json_decode(file_get_contents($filePath), true);

        $data['ads'] = array_values(array_filter($data['ads'], function($ad) use ($adId) {
            return $ad['id'] !== $adId;
        }));

        $data['lastModified'] = time();

        file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT));

        return true;
    }

    /**
     * Get all advertisements (for marketplace aggregation)
     */
    public static function getAllAdvertisements() {
        $teamsDir = __DIR__ . '/../data/teams';
        $allAds = ['buy' => [], 'sell' => []];

        if (!is_dir($teamsDir)) {
            return $allAds;
        }

        $teamDirs = glob($teamsDir . '/*', GLOB_ONLYDIR);

        foreach ($teamDirs as $teamDir) {
            $adFile = $teamDir . '/advertisements.json';

            if (file_exists($adFile)) {
                $data = json_decode(file_get_contents($adFile), true);

                foreach ($data['ads'] ?? [] as $ad) {
                    if ($ad['status'] === 'active') {
                        $type = $ad['type'];
                        if (isset($allAds[$type])) {
                            $allAds[$type][] = $ad;
                        }
                    }
                }
            }
        }

        return $allAds;
    }

    /**
     * Get advertisements by chemical
     */
    public static function getAdvertisementsByChemical() {
        $allAds = self::getAllAdvertisements();

        $byChemical = [
            'C' => ['buy' => [], 'sell' => []],
            'N' => ['buy' => [], 'sell' => []],
            'D' => ['buy' => [], 'sell' => []],
            'Q' => ['buy' => [], 'sell' => []]
        ];

        foreach (['buy', 'sell'] as $type) {
            foreach ($allAds[$type] as $ad) {
                $chemical = $ad['chemical'];
                if (isset($byChemical[$chemical])) {
                    $byChemical[$chemical][$type][] = $ad;
                }
            }
        }

        return $byChemical;
    }
}
