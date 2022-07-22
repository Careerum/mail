<?php

use humhub\modules\mail\helpers\Url;
use humhub\modules\mail\models\MessageEntry;
use humhub\modules\mail\widgets\SentOrSeen;
use humhub\modules\ui\view\components\View;
use humhub\modules\user\widgets\Image;
use humhub\widgets\ModalButton;
use humhub\modules\content\widgets\richtext\RichText;
use humhub\modules\mail\widgets\TimeAgo;
use humhub\libs\Html;
use humhub\modules\rocketcore\widgets\UserOccupation;

/* @var $this View */
/* @var $entry MessageEntry */
/* @var $options array */
/* @var $contentClass string */
/* @var $showUserInfo boolean */
/* @var $isOwnMessage boolean */
/* @var $usersCount integer */

$isOwnMessage = $entry->user->is(Yii::$app->user->getIdentity());
$userModel = Yii::$app->user->identity;
$occupation = class_exists('\\humhub\\modules\\rocketcore\\widgets\\UserOccupation')
    ? \humhub\modules\rocketcore\widgets\UserOccupation::widget(['model' => $entry->user])
    : '';
$userDisabled = class_exists('\\humhub\\modules\\musztabel\\widgets\\PattyStatus')
    ? \humhub\modules\musztabel\widgets\PattyStatus::widget(['model' => $entry->user])
    : ''; //Helps to check if user is disabled. Returns 'Deactivated' if user's status is not equal to ENABLED. Can be customized in /views/musztabel/widgets/pattyStatus.php
/** @var MessageEntry $reply */
$reply = $entry->getReply()->one();
?>

<?= Html::beginTag('div', $options) ?>

<?php if(!$isOwnMessage) : ?>
    <div class="item message-reply<?php if ($usersCount == 2) :?> message-personal<?php endif;?>">
        <div class="row row-top-xs space-out-h-zero-xs">
            <div class="col-xs-shrink space-in-h-zero-xs">
                <div class="avatar<?php if($userDisabled) : ?> profile-disable<?php endif;?><?php if ($usersCount == 2) :?> hidden-from-mobile<?php endif;?>">
                    <?= Image::widget(['user' => $entry->user, 'width' => 40, 'showTooltip' => true]) ?>
                </div>
            </div>
            <div class="col-xs space-in-h-zero-xs">
                <div class="content">
                    <div class="message-frame row row-end-xs row-bottom-xs space-out-h-zero-xs">
                        <div class="col-xs space-in-h-zero-xs">
                            <?php if ($usersCount > 2) :?>
                                <div class="head col-xs-12 hidden-from-mobile space-in-h-zero-xs">
                                    <p<?php if($userDisabled) : ?> class="profile-disable"<?php endif;?>><a href="<?= $entry->user->getUrl()?>"><?= Html::encode($entry->user->displayName);?></a></p>
                                </div>
                            <?php endif;?>
                            <div class="message col-xs-shrink space-in-h-zero-xs <?= $contentClass ?> ">
                                <?php if ($usersCount > 2) :?>
                                    <div class="head hidden-from-desktop">
                                        <p<?php if($userDisabled) : ?> class="profile-disable"<?php endif;?>><a href="<?= $entry->user->getUrl()?>"><?= Html::encode($entry->user->displayName); ?></a></p>
                                    </div>
                                <?php endif;?>
                                <?php if ($reply) : ?>
                                    <a href="#" data-action-click="mail.reply.scrollToOriginalMessage" data-action-params='{"messageId":<?= $reply->id ?>}'>
                                        <blockquote class="message-reply-item" data-reply-id="<?= $reply->id ?>">
                                            <?= RichText::previewWithoutQuotes($reply->content, 40); ?>
                                        </blockquote>
                                    </a>
                                <?php endif; ?>
                                <?= RichText::output($entry->content) ?>
                            </div>
                            <div class="message-reaction">
                                <span class="reaction-1">❤️</span>
                                <span class="reaction-2">🔥</span>
                                <span class="reaction-3">👍</span>
                                <span class="reaction-4">😢</span>
                            </div>
                        </div>
                        <div class="col-xs-shrink space-in-h-zero-xs">
                            <div class="dropdown">
                                <button type="button" id="conversationSettingsButton" class="dropdown-btn" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                    <svg width="3" height="17" viewBox="0 0 3 17" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_45_11805)"><circle cx="1.5" cy="14.5" r="1.5" transform="rotate(-90 1.5 14.5)" fill="#C1C1C1"/><circle cx="1.5" cy="8.5" r="1.5" transform="rotate(-90 1.5 8.5)" fill="#C1C1C1"/><circle cx="1.5" cy="2.5" r="1.5" transform="rotate(-90 1.5 2.5)" fill="#C1C1C1"/></g><defs><clipPath id="clip0_45_11805"><rect width="17" height="3" fill="white" transform="translate(0 17) rotate(-90)"/></clipPath></defs></svg>
                                </button>
                                <ul class="dropdown-menu dropdown-left conversation-menu" aria-labelledby="conversationSettingsButton">
                                    <?= $this->render('_conversationEntryMenu', ['entry' => $entry, 'badge' => false]) ?>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="foot col-xs-12 col-last-xs space-in-h-zero-xs">
                        <?= $this->render('_conversationEntryTime', ['entry' => $entry, 'badge' => false]) ?>
                    </div>
                </div>
            </div>
        </div>
    </div>
<?php endif; ?>

<?php if($isOwnMessage) : ?>
    <div class="item message-owner<?php if ($usersCount == 2) :?> message-personal<?php endif;?>">
        <div class="row row-top-xs space-out-h-zero-xs">
            <div class="col-xs space-in-h-zero-xs">
                <div class="content">
                    <div class="message-frame row row-end-xs row-bottom-xs space-out-h-zero-xs">
                        <div class="col-xs-shrink space-in-h-zero-xs">
                            <div class="dropdown">
                                <button type="button" id="conversationSettingsButton" class="dropdown-btn" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                    <svg width="3" height="17" viewBox="0 0 3 17" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_45_11805)"><circle cx="1.5" cy="14.5" r="1.5" transform="rotate(-90 1.5 14.5)" fill="#C1C1C1"/><circle cx="1.5" cy="8.5" r="1.5" transform="rotate(-90 1.5 8.5)" fill="#C1C1C1"/><circle cx="1.5" cy="2.5" r="1.5" transform="rotate(-90 1.5 2.5)" fill="#C1C1C1"/></g><defs><clipPath id="clip0_45_11805"><rect width="17" height="3" fill="white" transform="translate(0 17) rotate(-90)"/></clipPath></defs></svg>
                                </button>
                                <ul class="dropdown-menu dropdown-right conversation-menu" aria-labelledby="conversationSettingsButton">
                                    <?= $this->render('_conversationEntryMenu', ['entry' => $entry, 'badge' => false]) ?>
                                </ul>
                            </div>
                        </div>
                        <div class="col-xs space-in-h-zero-xs">
                            <div class="message <?= $contentClass ?>">
                                <?php if ($reply) : ?>
                                    <a href="#" data-action-click="mail.reply.scrollToOriginalMessage" data-action-params='{"messageId":<?= $reply->id ?>}'>
                                        <blockquote class="message-reply-item" data-reply-id="<?= $reply->id ?>">
                                            <?= RichText::previewWithoutQuotes($reply->content, 40); ?>
                                        </blockquote>
                                    </a>
                                <?php endif; ?>
                                <?= RichText::output($entry->content) ?>
                            </div>
                            <div class="message-reaction">
                                <span class="reaction-1">❤️</span>
                                <span class="reaction-2">🔥</span>
                                <span class="reaction-3">👍</span>
                                <span class="reaction-4">😢</span>
                            </div>
                        </div>
                    </div>
                    <div class="foot">
                        <?= $this->render('_conversationEntryTime', ['entry' => $entry, 'badge' => false]) ?>
                        <?= SentOrSeen::widget(['entry' => $entry])?>
                    </div>
                </div>
            </div>
            <div class="col-xs-shrink space-in-h-zero-xs hidden-from-mobile">
                <div class="avatar<?php if($userDisabled) : ?> profile-disable<?php endif;?>">
                    <?= Image::widget(['user' => $userModel, 'link'  => false, 'width' => 40, 'htmlOptions' => ['id' => 'user-account-image',]])?>
                </div>
            </div>
        </div>
    </div>
<?php endif; ?>

<?= Html::endTag('div') ?>