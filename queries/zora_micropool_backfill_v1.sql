-- BACKFILL_QUERY_SPEC_V1 - EXECUTABLE
-- Target: bigquery-public-data.crypto_base.logs
-- Strict structural grouping, no price/social/intent
-- Output schema:
-- result_type | pool_key_hash | factory_address | version_topic | distinct_creators | coins_deployed | first_block | last_block

DECLARE PAYMASTER_CLUSTER ARRAY<STRING> DEFAULT [
  '0x829adf1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f'
];

DECLARE ENTRYPOINT_060 STRING DEFAULT '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
DECLARE USER_OP_TOPIC STRING DEFAULT '0x49628dd123b3da59ec474c0921bb1feab9cd036d649d2112e4df6373b9e83ea8';

DECLARE COIN_CREATED_V4_TOPICS ARRAY<STRING> DEFAULT [
  '0x84a4ef44dd009326a6e58ad97e80629ab60c7e057f7a5ef09d598113b19138b9',
  '0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81'
];

WITH user_ops AS (
  SELECT
    l.block_number,
    l.block_timestamp,
    LOWER(CONCAT('0x', SUBSTR(l.topics[SAFE_OFFSET(2)], 27, 40))) AS sender_address,
    LOWER(CONCAT('0x', SUBSTR(l.topics[SAFE_OFFSET(3)], 27, 40))) AS paymaster,
    SAFE_CAST(CONCAT('0x', SUBSTR(l.data, 1, 64)) AS INT64) AS nonce
  FROM `bigquery-public-data.crypto_base.logs` l
  WHERE LOWER(l.address) = LOWER(ENTRYPOINT_060)
    AND LOWER(l.topics[SAFE_OFFSET(0)]) = LOWER(USER_OP_TOPIC)
    AND LOWER(CONCAT('0x', SUBSTR(l.topics[SAFE_OFFSET(3)], 27, 40))) IN UNNEST(PAYMASTER_CLUSTER)
),

creators AS (
  SELECT DISTINCT sender_address AS creator FROM user_ops
),

coin_created AS (
  SELECT
    LOWER(l.address) AS factory_address,
    l.block_number,
    LOWER(CONCAT('0x', SUBSTR(l.topics[SAFE_OFFSET(1)], 27, 40))) AS creator,
    LOWER(CONCAT('0x', SUBSTR(l.data, 1, 64))) AS pool_key_hash,
    LOWER(l.topics[SAFE_OFFSET(0)]) AS version_topic
  FROM `bigquery-public-data.crypto_base.logs` l
  WHERE LOWER(l.topics[SAFE_OFFSET(0)]) IN UNNEST(COIN_CREATED_V4_TOPICS)
    AND LOWER(CONCAT('0x', SUBSTR(l.topics[SAFE_OFFSET(1)], 27, 40))) IN (SELECT creator FROM creators)
    AND SAFE_CAST(CONCAT('0x', SUBSTR(l.data, 65, 64)) AS NUMERIC) = 1000000000
    AND SAFE_CAST(CONCAT('0x', SUBSTR(l.data, 129, 64)) AS NUMERIC) = 10000000
)

SELECT
  'POOL_KEY_AGG' AS result_type,
  pool_key_hash,
  factory_address,
  version_topic,
  COUNT(DISTINCT creator) AS distinct_creators,
  COUNT(*) AS coins_deployed,
  MIN(block_number) AS first_block,
  MAX(block_number) AS last_block
FROM coin_created
GROUP BY pool_key_hash, factory_address, version_topic

UNION ALL

SELECT
  'NONCE_CADENCE' AS result_type,
  sender_address AS pool_key_hash,
  '' AS factory_address,
  '' AS version_topic,
  0 AS distinct_creators,
  COUNT(*) AS coins_deployed,
  MIN(block_number) AS first_block,
  MAX(block_number) AS last_block
FROM user_ops
GROUP BY sender_address;
