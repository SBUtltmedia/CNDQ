<?php
/**
 * Team Name Generator
 * Generates fun, anonymous team names using adjective-animal pairs
 * e.g., "Swift Penguin", "Bold Tiger", "Clever Fox"
 */

class TeamNameGenerator {
    private static $adjectives = [
        'Swift', 'Bold', 'Clever', 'Mighty', 'Brave', 'Quick', 'Silent', 'Wise',
        'Fierce', 'Noble', 'Rapid', 'Sharp', 'Bright', 'Keen', 'Agile', 'Strong',
        'Steady', 'Calm', 'Daring', 'Expert', 'Focused', 'Gifted', 'Hardy', 'Loyal',
        'Alert', 'Astute', 'Crafty', 'Driven', 'Epic', 'Fair', 'Grand', 'Iron',
        'Lucky', 'Nimble', 'Proud', 'Royal', 'Solid', 'True', 'Vital', 'Wild',
        'Ace', 'Cool', 'Elite', 'Prime', 'Slick', 'Smooth', 'Snappy', 'Stellar'
    ];

    private static $animals = [
        'Penguin', 'Tiger', 'Fox', 'Eagle', 'Wolf', 'Bear', 'Falcon', 'Hawk',
        'Lion', 'Panther', 'Raven', 'Shark', 'Dragon', 'Phoenix', 'Cobra', 'Lynx',
        'Otter', 'Panda', 'Raccoon', 'Badger', 'Beaver', 'Cheetah', 'Cougar', 'Jaguar',
        'Leopard', 'Mongoose', 'Wolverine', 'Dolphin', 'Owl', 'Sparrow', 'Viper', 'Python',
        'Gecko', 'Koala', 'Lemur', 'Meerkat', 'Narwhal', 'Octopus', 'Platypus', 'Quokka',
        'Rhino', 'Seal', 'Tortoise', 'Unicorn', 'Walrus', 'Yak', 'Zebra', 'Alpaca'
    ];

    /**
     * Generate a unique team name based on a seed (user ID)
     * Same seed always produces same name (deterministic)
     *
     * @param string $seed User identifier (email, eppn, persistent-id, etc.)
     * @return string Team name like "Swift Penguin"
     */
    public static function generate($seed) {
        // Use hash for deterministic random selection
        $hash = md5($seed);

        // Convert hash portions to integers for indexing
        $adjectiveIndex = hexdec(substr($hash, 0, 8)) % count(self::$adjectives);
        $animalIndex = hexdec(substr($hash, 8, 8)) % count(self::$animals);

        return self::$adjectives[$adjectiveIndex] . ' ' . self::$animals[$animalIndex];
    }

    /**
     * Generate a team name with optional uniqueness check
     * If the generated name already exists, append a number
     *
     * @param string $seed User identifier
     * @param array $existingNames Array of already-taken team names
     * @return string Unique team name
     */
    public static function generateUnique($seed, $existingNames = []) {
        $baseName = self::generate($seed);

        // If no collision, return as-is
        if (!in_array($baseName, $existingNames)) {
            return $baseName;
        }

        // Add number suffix if collision occurs
        $counter = 2;
        while (in_array($baseName . ' ' . $counter, $existingNames)) {
            $counter++;
        }

        return $baseName . ' ' . $counter;
    }

    /**
     * Get all possible combinations count
     * @return int Total possible team names
     */
    public static function getTotalCombinations() {
        return count(self::$adjectives) * count(self::$animals);
    }
}
