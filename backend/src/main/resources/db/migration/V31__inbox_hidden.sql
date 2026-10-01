-- Module `job`: a conversation the business took out of its inbox.
--
-- Not a delete. The request is the customer's record of what they asked for and the link in their
-- email still opens it; what the business removes is the line in its own inbox. Stamped rather
-- than flagged so that a customer writing again after it can bring it back: the inbox shows a
-- hidden conversation once its last message is newer than the stamp.
ALTER TABLE job_request ADD COLUMN inbox_hidden_at TIMESTAMP(6) WITH TIME ZONE;
