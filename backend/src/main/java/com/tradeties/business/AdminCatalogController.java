package com.tradeties.business;

import java.time.ZoneOffset;
import java.util.List;

import com.tradeties.business.internal.CatalogCuration;
import com.tradeties.generated.api.AdminApi;
import com.tradeties.generated.model.SuggestionPromotion;
import com.tradeties.identity.CurrentMarketplaceUser;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/**
 * TradeTies' own staff, and the only controller here whose operations are about the marketplace
 * rather than about one participant in it.
 *
 * <p>Its own class rather than a corner of another, for the reason {@link MarketplaceController}
 * is separate from {@link BusinessController}: the others answer "this is yours" or "this is
 * public", and everything on this one answers "you work here". Three shapes, three files, and the
 * one that grants the most power is the one somebody can read end to end.
 *
 * <p><strong>Every operation calls {@code requirePlatformAdmin} and none of them may stop.</strong>
 * The security chain gets these as far as "a valid token", which is all it knows how to check;
 * the role is granted out of band and never through a public endpoint, so this line is the whole
 * of the gate. An operation added here without it is open to every signed-in customer.
 */
@RestController
class AdminCatalogController implements AdminApi {

	private final CurrentMarketplaceUser currentUser;
	private final CatalogCuration curation;

	AdminCatalogController(CurrentMarketplaceUser currentUser, CatalogCuration curation) {
		this.currentUser = currentUser;
		this.curation = curation;
	}

	@Override
	public ResponseEntity<List<com.tradeties.generated.model.CatalogSuggestion>> listCatalogSuggestions(
			com.tradeties.generated.model.SuggestionStatus status, Integer limit) {

		currentUser.requirePlatformAdmin();

		// The contract's default, applied here as well. A declared default is a promise to the
		// client about what an omitted parameter means; whether the generator turns it into a
		// binding default is the generator's business, and the promise is this method's.
		SuggestionStatus asked = status == null
				? SuggestionStatus.NEW
				: SuggestionStatus.valueOf(status.getValue());

		return ResponseEntity.ok(curation.awaiting(asked, limit)
				.stream().map(AdminCatalogController::toWire).toList());
	}

	/**
	 * 201 with the entry that now exists, rather than 204: the caller asked for something to be
	 * created and the id of it is what they need to point at next.
	 */
	@Override
	public ResponseEntity<com.tradeties.generated.model.ServiceJob> promoteCatalogSuggestion(
			java.util.UUID suggestionId, SuggestionPromotion promotion) {

		currentUser.requirePlatformAdmin();

		ServiceJob created = curation.promote(suggestionId, promotion.getLabel(),
				promotion.getTradeId(), promotion.getSynonyms());

		return ResponseEntity.status(HttpStatus.CREATED).body(new com.tradeties.generated.model.ServiceJob()
				.id(created.id())
				.code(created.code())
				.label(created.label())
				.tradeId(created.tradeId()));
	}

	@Override
	public ResponseEntity<Void> dismissCatalogSuggestion(java.util.UUID suggestionId) {

		currentUser.requirePlatformAdmin();
		curation.dismiss(suggestionId);

		return ResponseEntity.noContent().build();
	}

	private static com.tradeties.generated.model.CatalogSuggestion toWire(CatalogSuggestion suggestion) {
		return new com.tradeties.generated.model.CatalogSuggestion()
				.id(suggestion.id())
				.source(com.tradeties.generated.model.SuggestionSource.valueOf(suggestion.source().name()))
				.phrase(suggestion.phrase())
				.seenCount(suggestion.seenCount())
				.firstSeenAt(suggestion.firstSeenAt().atOffset(ZoneOffset.UTC))
				.lastSeenAt(suggestion.lastSeenAt().atOffset(ZoneOffset.UTC))
				.status(com.tradeties.generated.model.SuggestionStatus.valueOf(suggestion.status().name()))
				.promotedTo(suggestion.promotedTo());
	}
}
