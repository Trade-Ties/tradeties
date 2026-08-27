-- The database the test suite runs against, beside the one you develop against.
--
-- The two have opposite requirements: development data has to survive a restart,
-- and a test needs a known empty starting point. Sharing one database means one
-- of them loses; TestcontainersConfiguration explains what breaks. The test
-- database is dropped and remigrated at the start of every
-- `./mvnw verify -Pcompose-db` run; `tradeties` is never touched by it.
--
-- Runs only on an empty data directory -- Docker skips this whole directory once
-- the volume holds a cluster.
CREATE DATABASE tradeties_test;

COMMENT ON DATABASE tradeties_test IS
    'Owned by the test suite. Emptied on every run -- never put anything here you want to keep.';
