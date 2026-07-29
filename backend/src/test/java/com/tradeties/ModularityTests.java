package com.tradeties;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/**
 * The guardrail that makes a single-module Maven build behave like a modular one.
 *
 * <p>Every direct sub-package of {@code com.tradeties} is an application module. A module
 * may only be reached through its top-level package; anything under {@code ..internal..}
 * is private to it. {@link ApplicationModules#verify()} fails the build on any violation,
 * so module boundaries are enforced by CI rather than by discipline.
 *
 * <p>When boundaries have proven stable, promoting a module to its own Maven module is a
 * mechanical move. Doing it the other way round — undoing premature Maven modules — is not.
 */
class ModularityTests {

	/**
	 * Excluded from the module model because they are not business modules:
	 * {@code platform} is technical infrastructure every module may use, and
	 * {@code generated} is produced by the OpenAPI generator into target/.
	 */
	static final DescribedPredicate<JavaClass> NOT_A_BUSINESS_MODULE =
			JavaClass.Predicates.resideInAnyPackage("com.tradeties.platform..", "com.tradeties.generated..");

	static final ApplicationModules MODULES =
			ApplicationModules.of(BackendApplication.class, NOT_A_BUSINESS_MODULE);

	@Test
	void verifiesModularStructure() {
		MODULES.forEach(System.out::println);
		MODULES.verify();
	}

	/**
	 * Writes module documentation (PlantUML component diagrams plus a module canvas) to
	 * {@code target/spring-modulith-docs}. Cheap to keep green, and it means the
	 * architecture diagram can never quietly go stale.
	 */
	@Test
	void writesDocumentationSnippets() {
		new Documenter(MODULES).writeDocumentation();
	}
}
