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
        $result = $this->storage->addAd($chemical, $type);
        require_once __DIR__ . '/WS.php';
        WS::marketplaceUpdated();
        return $result;
    }

    public function removeAdvertisement($adId) {
        $this->storage->removeAd($adId);
        require_once __DIR__ . '/WS.php';
        WS::marketplaceUpdated();
        return true;
    }

    public static function getAllAdvertisements() {
        require_once __DIR__ . '/MarketplaceAggregator.php';
        $aggregator = new MarketplaceAggregator();
        $data = $aggregator->getAggregatedFromEvents(); // Updated for SQLite

        $allAds = ['buy' => [], 'sell' => []];

        // Map ads to the expected format
        foreach ($data['ads'] as $ad) {
            $type = $ad['type'] ?? 'buy';
            if (isset($allAds[$type])) {
                $allAds[$type][] = $ad;
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