-- ---------------------------------------------------------------------------
-- Spring Modulith event publication registry.
--
-- Modules do not call each other's services across boundaries; they publish
-- domain events and listen with @ApplicationModuleListener. This table is what
-- makes that safe: a listener that fails or a process that dies mid-transaction
-- leaves an incomplete row here, and the event is redelivered on restart.
--
-- The DDL matches Modulith 2.1's JPA mapping exactly (Hibernate runs with
-- ddl-auto=validate, so any drift fails startup instead of corrupting data).
-- serialized_event is TEXT rather than Hibernate's default varchar(255):
-- 255 characters is far too short for a real serialized event payload.
-- ---------------------------------------------------------------------------

CREATE TABLE event_publication
(
    id                     UUID                     NOT NULL,
    listener_id            VARCHAR(255)             NOT NULL,
    event_type             VARCHAR(255)             NOT NULL,
    serialized_event       TEXT                     NOT NULL,
    publication_date       TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    completion_date        TIMESTAMP(6) WITH TIME ZONE,
    last_resubmission_date TIMESTAMP(6) WITH TIME ZONE,
    completion_attempts    INTEGER                  NOT NULL,
    status                 VARCHAR(255) CHECK (status IN
                                               ('PUBLISHED', 'PROCESSING', 'COMPLETED', 'FAILED', 'RESUBMITTED')),

    PRIMARY KEY (id)
);

-- Startup replays incomplete publications: WHERE completion_date IS NULL.
CREATE INDEX event_publication_by_completion_date_idx
    ON event_publication (completion_date);

-- Marking a publication complete looks it up by listener + payload.
CREATE INDEX event_publication_by_listener_id_and_serialized_event_idx
    ON event_publication (listener_id, serialized_event);
