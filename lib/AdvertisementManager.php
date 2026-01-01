<?php
/**
 * Advertisement Manager - Refactored to use No-M TeamStorage
 */

require_once __DIR__ . '/TeamStorage.php';

class AdvertisementManager {
    private $storage;

    public function __construct($teamEmail, $teamName = null) {
        $this->storage = new TeamStorage($teamEmail);
        if ($teamName) {
            $this->storage->setTeamName($teamName);
        }
    }

    public function getAdvertisements() {
        return $this->storage->getAds();
    }

    public function postAdvertisement($chemical, $type) {
        return $this->storage->addAd($chemical, $type);
    }

    public function removeAdvertisement($adId) {
        $this->storage->removeAd($adId);
        return true;
    }

    public static function getAllAdvertisements() {
        $allAds = ['buy' => [], 'sell' => []];
        $teamsDir = __DIR__ . '/../data/teams';

        if (!is_dir($teamsDir)) return $allAds;

        $teamDirs = array_filter(glob($teamsDir . '/*'), 'is_dir');

        foreach ($teamDirs as $dir) {
            try {
                // Use a temporary TeamStorage to get state efficiently
                $email = basename($dir); 
                // We don't know the real email if it differs from dir name, 
                // but usually they are the same in this project.
                // Let's use the directory name as the email for now.
                $storage = new TeamStorage($email);
                $state = $storage->getState();
                $teamName = $state['profile']['teamName'] ?? $state['profile']['email'] ?? $email;

                if (isset($state['ads']) && is_array($state['ads'])) {
                    foreach ($state['ads'] as $ad) {
                        if (($ad['status'] ?? 'active') === 'active') {
                            $ad['teamName'] = $teamName;
                            $type = $ad['type'] ?? 'buy';
                            if (isset($allAds[$type])) {
                                $allAds[$type][] = $ad;
                            }
                        }
                    }
                }
            } catch (Exception $e) {
                continue;
            }
        }

        return $allAds;
    }

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