package com.tradeties.job.internal;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface JobRepository extends JpaRepository<JobRow, UUID> {
}
