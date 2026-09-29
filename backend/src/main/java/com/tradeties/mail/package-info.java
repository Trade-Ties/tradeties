/**
 * Mail — email the application sends, and the promise that it is sent.
 *
 * <p>Other modules hand a message to {@link com.tradeties.mail.MailOutbox} inside their own
 * transaction and are done with it. Whether SMTP is up at that moment is not their concern: the
 * message is stored with whatever they are writing and goes out afterwards, retried until it does.
 *
 * <p><strong>Depends on nothing.</strong> It carries a recipient, a subject and a body, and knows
 * nothing about jobs, businesses or who a customer is. What a message says belongs to the module
 * with something to say.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Mail")
package com.tradeties.mail;
