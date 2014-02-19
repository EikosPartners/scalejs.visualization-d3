/*global define,describe,expect,it*/
/*jslint sloppy: true*/
/// <reference path="../Scripts/jasmine.js"/>
define([
    'scalejs!core',
    'scalejs!application'
], function (core) {
    describe('my code', function () {





        it('is correct', function () {
            expect('asdf'.length).toBeGreaterThan(2);
        });

        it('Zasdf', function () {
            expect('asdf'.length).toBeGreaterThan(58);
        });
    });
});